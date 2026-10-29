const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const chromeCandidates = [
  process.env.CHROME_PATH,
  process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : null,
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null,
  process.platform === 'linux' ? '/usr/bin/google-chrome' : null,
  process.platform === 'linux' ? '/usr/bin/chromium' : null
].filter(Boolean);
const systemBrowser = chromeCandidates.find(candidate => fs.existsSync(candidate));
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'reports');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
const routes = ['beranda','siswa','guru','galeri','video','komentar'];
const results = [];
(async () => {
  const { createServer } = await import('vite');
  const viteServer = await createServer({
    configFile: path.join(ROOT_DIR, 'vite.config.js'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 }
  });
  await viteServer.listen();
  const address = viteServer.httpServer.address();
  if (!address || typeof address === 'string') {
    await viteServer.close();
    throw new Error('Could not determine the Vite preview server address.');
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      ...(systemBrowser ? {executablePath: systemBrowser} : {}),
      args: ['--no-sandbox','--disable-setuid-sandbox']
    });
    for (const route of routes) {
      const file = path.join(ROOT_DIR, "index.html");
      if (!fs.existsSync(file)) continue;
      const page = await browser.newPage();
      const messages = [];

      page.on('console', msg => {
        messages.push({type: 'console.'+msg.type(), text: msg.text()});
      });
      page.on('pageerror', err => {
        messages.push({type: 'pageerror', text: err.message});
      });
      page.on('requestfailed', req => {
        messages.push({type: 'requestfailed', url: req.url(), reason: req.failure().errorText});
      });

      try {
        const url = `http://127.0.0.1:${address.port}/index.html#/${route}`;
        await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
        await page.waitForTimeout(500);
        const mobileHoverTargets = {
          beranda: '.hero-cta',
          siswa: '.people-card',
          guru: '.people-card',
          galeri: '.gallery-item',
          video: '.video-card',
          komentar: '.hero-cta'
        };
        const mobilePage = await browser.newPage();
        try {
          await mobilePage.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true});
          await mobilePage.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
          assert.equal(
            await mobilePage.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches),
            false,
            'Touch emulation should not qualify for desktop hover effects.'
          );
          const hoverElement = await mobilePage.$(mobileHoverTargets[route]);
          assert.ok(hoverElement, `${route} has a visible hover-test target.`);
          const visualState = element => mobilePage.evaluate(node => {
            const style = getComputedStyle(node);
            return [style.backgroundColor, style.color, style.borderColor, style.boxShadow, style.transform];
          }, element);
          const beforeHover = await visualState(hoverElement);
          await hoverElement.hover();
          await mobilePage.waitForTimeout(200);
          assert.deepEqual(
            await visualState(hoverElement),
            beforeHover,
            `${route} should not retain desktop hover highlighting on touch.`
          );
        } finally {
          await mobilePage.close();
        }
        {
          const navigationRoute = route === 'komentar' ? 'beranda' : route;
          assert.equal(await page.$eval('.tab.active', tab => tab.dataset.page), navigationRoute);
          assert.equal(
            await page.$eval('.tab.active', tab => tab.getAttribute('href')),
            `#/${navigationRoute}`
          );
          if (route === 'siswa' || route === 'guru') {
          const expectedCount = await page.evaluate(() => {
            const data = window.XIRPL1_DATA;
            return document.body.dataset.page === 'guru'
              ? data.GURU.length
              : data.SISWA.length;
          });
          assert.equal(await page.$$eval('.people-card', cards => cards.length), expectedCount);
          assert.equal(
            await page.$eval('.tab.active', tab => tab.dataset.page),
            route
          );

          const search = await page.$eval('input[type="search"]', input => input.getAttribute('aria-label'));
          assert.ok(search, 'React people page has an accessible search field.');
          const searchTerm = await page.evaluate(() => {
            const data = window.XIRPL1_DATA;
            const people = document.body.dataset.page === 'guru' ? data.GURU : data.SISWA;
            return people[0].nama;
          });
          await page.type('input[type="search"]', searchTerm);
          const matchingCount = await page.evaluate(() => {
            const data = window.XIRPL1_DATA;
            const people = document.body.dataset.page === 'guru' ? data.GURU : data.SISWA;
            const query = document.querySelector('input[type="search"]').value.toLowerCase();
            return people.filter(person =>
              person.nama.toLowerCase().includes(query) ||
              (person.jabatan || person.mapel).toLowerCase().includes(query)
            ).length;
          });
          assert.equal(await page.$$eval('.people-card', cards => cards.length), matchingCount);

          await page.click('input[type="search"]');
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.type('input[type="search"]', '__no_matching_person__');
          assert.equal(await page.$$eval('.people-card', cards => cards.length), 0);
          assert.ok(await page.$('.empty-note'), 'Empty search results show an explanation.');
          } else if (route === 'galeri') {
            const count = await page.evaluate(() => window.XIRPL1_DATA.GALERI.length);
            assert.equal((await page.$$('.gallery-item')).length, count);
            await page.click('.gallery-item');
            assert.ok(await page.$('[role="dialog"]'), 'Selecting a photo opens its dialog.');
            await page.keyboard.press('Escape');
            assert.equal(await page.$('[role="dialog"]'), null, 'Escape closes the photo dialog.');
          } else if (route === 'video') {
            const count = await page.evaluate(() => window.XIRPL1_DATA.VIDEO.length);
            assert.equal((await page.$$('.video-card')).length, count);
            assert.ok(await page.$('.video-frame iframe[title]'), 'Video embeds have accessible titles.');
          } else if (route === 'beranda') {
            assert.ok(await page.$('.hero-beranda'), 'Home page renders the class hero.');
            assert.equal((await page.$$('.stat-card')).length, 3);
            assert.ok(await page.$('.agenda-card--schedule'), 'Home page renders the schedule dashboard.');
            assert.ok(await page.$('.agenda-card--duty'), 'Home page renders the duty dashboard.');
            assert.equal((await page.$$('.agenda-day-button')).length, 2);
            const currentDay = await page.$eval('.agenda-card--duty .agenda-eyebrow', node => node.textContent);
            await page.click('.agenda-day-button:nth-child(2)');
            assert.equal(
              await page.$eval('.agenda-day-button:nth-child(2)', button => button.getAttribute('aria-pressed')),
              'true'
            );
            assert.notEqual(
              await page.$eval('.agenda-card--duty .agenda-eyebrow', node => node.textContent),
              currentDay,
              'Selecting tomorrow updates the duty schedule.'
            );
            await page.click('.agenda-day-button:first-child');
          } else if (route === 'komentar') {
            assert.ok(await page.$('textarea[maxlength="500"]'), 'Comment form enforces the 500 character limit.');
            await page.type('#commentInput', 'Tes komentar');
            assert.equal(await page.$eval('.comment-form-footer span', node => node.textContent), '12/500');
          }

          await page.setViewport({width: 390, height: 844});
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            `${route} should not overflow horizontally at mobile width.`
          );
          await page.click('.menu-toggle');
          assert.equal(await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')), 'true');
          assert.ok(await page.$eval('.tabbar', nav => nav.classList.contains('open')));
          await page.click('.menu-toggle');
          assert.equal(await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')), 'false');
          const previousTheme = await page.$eval('.theme-toggle', button => button.getAttribute('aria-pressed'));
          await page.click('.theme-toggle');
          assert.notEqual(await page.$eval('.theme-toggle', button => button.getAttribute('aria-pressed')), previousTheme);
          await page.click('.theme-toggle');
          const pageErrors = messages.filter(message => message.type === 'pageerror');
          assert.equal(pageErrors.length, 0, `${route} should not raise browser runtime errors.`);
        }
        const ssPath = path.join(SCREENSHOT_DIR, route + '.png');
        fs.mkdirSync(path.dirname(ssPath), {recursive:true});
        await page.screenshot({path:ssPath, fullPage:false});
        results.push({file:route, messages, screenshot:ssPath});
      } catch (err) {
        results.push({file:route, error: (err && err.message) || String(err), messages});
      }
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await viteServer.close();
  }
  fs.mkdirSync(REPORT_DIR, {recursive: true});
  fs.writeFileSync(path.join(REPORT_DIR, 'puppeteer-results.json'), JSON.stringify(results, null, 2));
  const failures = results.filter(result => result.error);
  if (failures.length) {
    throw new Error(`Browser checks failed: ${failures.map(result => `${result.file}: ${result.error}`).join('; ')}`);
  }
  console.log('Done. Results written to reports/puppeteer-results.json');
})();
