const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildLegacyCards, loadLegacyStudents } = require('./migrate-legacy');
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
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const browserCards = buildLegacyCards(loadLegacyStudents()).map(card => ({
  id: card.legacyId,
  slug: card.slug,
  nama: card.nama,
  jabatan: card.jabatan,
  hobi: card.hobi,
  catatan: card.catatan,
  foto: card.foto,
  ...(card.portfolio ? {portfolio: card.portfolio} : {}),
  sortOrder: card.sortOrder
}));

async function mockSiteApi(page) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/me') {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({user: null})
      });
    }
    if (pathname === '/api/cards') {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({cards: browserCards})
      });
    }
    return request.continue();
  });
}

(async () => {
  const { createServer } = await import('vite');
  const viteServer = await createServer({
    configFile: path.join(ROOT_DIR, 'vite.config.js'),
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0,
      watch: { ignored: ['**/*credentials*.env'] }
    }
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
      await mockSiteApi(page);

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
        await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000});
        await page.waitForSelector('#root > *', {timeout: 10000});
        await wait(250);
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
          await mockSiteApi(mobilePage);
          await mobilePage.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true});
          await mobilePage.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000});
          await mobilePage.waitForSelector(mobileHoverTargets[route], {timeout: 10000});
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
          await wait(200);
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
            assert.ok(await page.$('.video-frame button.video-play[aria-label]'), 'Video players have accessible labels.');
            await page.click('.video-play');
            assert.ok(await page.$('.video-frame iframe[title]'), 'Playing a video loads an embed with an accessible title.');
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
          const overflowDetails = await page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            elements: [...document.querySelectorAll('body *')]
              .filter(element => {
                const bounds = element.getBoundingClientRect();
                return bounds.right > window.innerWidth + 1 || bounds.left < -1;
              })
              .slice(0, 8)
              .map(element => ({
                selector: element.tagName.toLowerCase() +
                  (element.className && typeof element.className === 'string'
                    ? '.' + element.className.trim().replace(/\s+/g, '.')
                    : ''),
                left: Math.round(element.getBoundingClientRect().left),
                right: Math.round(element.getBoundingClientRect().right)
              }))
          }));
          assert.ok(
            overflowDetails.documentWidth <= overflowDetails.viewportWidth,
            `${route} should not overflow horizontally at mobile width: ${JSON.stringify(overflowDetails)}`
          );
          await page.click('.menu-toggle');
          assert.equal(await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')), 'true');
          assert.ok(await page.$eval('.tabbar', nav => nav.classList.contains('open')));
          await page.click('.menu-toggle');
          assert.equal(await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')), 'false');
          const previousTheme = await page.$eval('.theme-toggle', button => button.getAttribute('aria-pressed'));
          const footerBackground = await page.$eval(
            '.site-footer',
            footer => getComputedStyle(footer).backgroundColor
          );
          await page.click('.theme-toggle');
          assert.notEqual(await page.$eval('.theme-toggle', button => button.getAttribute('aria-pressed')), previousTheme);
          assert.equal(
            await page.$eval('.site-footer', footer => getComputedStyle(footer).backgroundColor),
            footerBackground,
            'Footer background stays dark when changing the page theme.'
          );
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

    async function runAuthLogin(next, displayName = "Browser Member") {
      const authPage = await browser.newPage();
      const authPageErrors = [];
      let loginHeaders = null;
      authPage.on('pageerror', error => authPageErrors.push(error.message));
      await authPage.setRequestInterception(true);
      authPage.on('request', request => {
        const pathname = new URL(request.url()).pathname;
        if (pathname === '/api/auth/me') {
          return request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({user: null})
          });
        }
        if (pathname === '/api/profile/me') {
          return request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {
                username: 'browser_member',
                displayName,
                role: 'member',
                joinedAt: '2026-01-01T00:00:00.000Z'
              },
              card: null
            })
          });
        }
        if (pathname === '/api/auth/login') {
          loginHeaders = request.headers();
          return request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {username: 'browser_member', displayName, role: 'member'},
              mustChangePassword: false
            })
          });
        }
        return request.continue();
      });

      try {
        await authPage.goto(
          `http://127.0.0.1:${address.port}/index.html#/login?next=${encodeURIComponent(next)}`,
          {waitUntil: 'domcontentloaded', timeout: 30000}
        );
        await authPage.waitForSelector('#login-username');
        assert.equal(
          await authPage.$eval('#login-username', input => input.autocomplete),
          'username'
        );
        assert.equal(
          await authPage.$eval('#login-password', input => input.autocomplete),
          'current-password'
        );
        assert.ok(
          await authPage.$('label[for="login-username"]'),
          'Login username has a visible label.'
        );
        await authPage.type('#login-username', 'browser_member');
        await authPage.type('#login-password', 'A-valid-password-48!');
        await authPage.click('.auth-submit');
        await authPage.waitForFunction(
          () => window.location.hash === '#/beranda' ||
            window.location.hash === '#/profil',
          {timeout: 10000}
        );
        assert.equal(loginHeaders?.['x-requested-with'], 'fetch');
        assert.equal(loginHeaders?.['content-type'], 'application/json');
        assert.equal(
          await authPage.evaluate(() => {
            const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
            return keys.some(key => /auth|session|token|user/i.test(key));
          }),
          false,
          'Auth data is not persisted in browser storage.'
        );
        assert.equal(authPageErrors.length, 0, 'Auth pages should not raise browser errors.');
        return authPage;
      } catch (error) {
        await authPage.close();
        throw error;
      }
    }

    for (const unsafeNext of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)'
    ]) {
      const authPage = await runAuthLogin(unsafeNext);
      try {
        assert.equal(
          await authPage.evaluate(() => window.location.hash),
          '#/beranda',
          `Unsafe redirect ${unsafeNext} should fall back to the home page.`
        );
      } finally {
        await authPage.close();
      }
    }

    const profilePage = await runAuthLogin(
      '/profil',
      '<img src=x onerror=alert(1)>'
    );
    try {
      await profilePage.waitForSelector('.account-details');
      assert.equal(await profilePage.$('button[aria-controls="profile-name-editor"]'), null);
      assert.equal(await profilePage.$('a[href="#/card-saya"]'), null);
      assert.equal(await profilePage.$('a[href="#/ganti-password"]'), null);
      assert.equal(
        await profilePage.$('img[src="x"]'),
        null,
        'Display names are rendered as text rather than HTML.'
      );
      assert.match(
        await profilePage.$eval('.profile-header h1', node => node.textContent),
        /<img src=x onerror=alert\(1\)>/
      );
      await profilePage.evaluate(() => {
        window.location.hash = '#/ganti-password';
      });
      await profilePage.waitForSelector('.auth-card h1');
      assert.match(
        await profilePage.$eval('.auth-card h1', node => node.textContent),
        /Perubahan password melalui admin/
      );
      assert.equal(await profilePage.$('#current-password'), null);
    } finally {
      await profilePage.close();
    }

    const publicProfilePage = await browser.newPage();
    const publicProfileErrors = [];
    await publicProfilePage.setRequestInterception(true);
    publicProfilePage.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/auth/me') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({user: null})
        });
      }
      if (pathname === '/api/profile/student_01') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              username: 'student_01',
              displayName: 'Public Student',
              role: 'student',
              joinedAt: '2026-01-01T00:00:00.000Z'
            },
            card: browserCards[0]
          })
        });
      }
      return request.continue();
    });
    publicProfilePage.on('pageerror', error => publicProfileErrors.push(error.message));
    try {
      await publicProfilePage.goto(
        `http://127.0.0.1:${address.port}/index.html#/profil/student_01`,
        {waitUntil: 'domcontentloaded', timeout: 30000}
      );
      await publicProfilePage.waitForSelector('.profile-card .people-card');
      assert.match(
        await publicProfilePage.$eval('.profile-header h1', node => node.textContent),
        /Public Student/
      );
      assert.equal(await publicProfilePage.$('button[aria-controls="profile-name-editor"]'), null);
      assert.equal(publicProfileErrors.length, 0, 'Public student profiles should not raise browser errors.');
    } finally {
      await publicProfilePage.close();
    }

    const ownedProfilePage = await browser.newPage();
    const ownedProfileErrors = [];
    let ownerDisplayName = 'Student Owner';
    ownedProfilePage.on('pageerror', error => ownedProfileErrors.push(error.message));
    await ownedProfilePage.setRequestInterception(true);
    ownedProfilePage.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/auth/me') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              username: 'student_owner',
              displayName: ownerDisplayName,
              role: 'student',
              mustChangePassword: false
            }
          })
        });
      }
      if (pathname === '/api/profile/me') {
        if (request.method() === 'PATCH') {
          const input = JSON.parse(request.postData());
          ownerDisplayName = input.displayName;
        }
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              username: 'student_owner',
              displayName: ownerDisplayName,
              role: 'student',
              joinedAt: '2026-01-01T00:00:00.000Z'
            },
            card: browserCards[0]
          })
        });
      }
      return request.continue();
    });
    try {
      await ownedProfilePage.goto(
        `http://127.0.0.1:${address.port}/index.html#/profil`,
        {waitUntil: 'domcontentloaded', timeout: 30000}
      );
      await ownedProfilePage.waitForSelector('.profile-header h1');
      await ownedProfilePage.waitForSelector('button[aria-controls="profile-name-editor"]');
      await ownedProfilePage.click('button[aria-controls="profile-name-editor"]');
      await ownedProfilePage.click('#profile-display-name');
      await ownedProfilePage.keyboard.down('Control');
      await ownedProfilePage.keyboard.press('A');
      await ownedProfilePage.keyboard.up('Control');
      await ownedProfilePage.type('#profile-display-name', 'Updated Student');
      await ownedProfilePage.click('.profile-name-form .auth-submit');
      await ownedProfilePage.waitForFunction(
        () => document.querySelector('.account-trigger-name')?.textContent === 'Updated Student',
        {timeout: 10000}
      );
      assert.match(
        await ownedProfilePage.$eval('.profile-header h1', node => node.textContent),
        /Updated Student/
      );
      assert.equal(ownedProfileErrors.length, 0, 'Owned profile edits should not raise browser errors.');
    } finally {
      await ownedProfilePage.close();
    }

    const cardEditorPage = await browser.newPage();
    const cardEditorErrors = [];
    let unsavedNavigationPrompts = 0;
    await cardEditorPage.setRequestInterception(true);
    cardEditorPage.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/auth/me') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              username: 'browser_student',
              displayName: 'Browser Student',
              role: 'student',
              mustChangePassword: false
            }
          })
        });
      }
      if (pathname === '/api/cards/me') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({card: browserCards[0]})
        });
      }
      return request.continue();
    });
    cardEditorPage.on('pageerror', error => cardEditorErrors.push(error.message));
    cardEditorPage.on('dialog', async dialog => {
      unsavedNavigationPrompts += 1;
      await dialog.dismiss();
    });
    try {
      await cardEditorPage.goto(
        `http://127.0.0.1:${address.port}/index.html#/card-saya`,
        {waitUntil: 'domcontentloaded', timeout: 30000}
      );
      await cardEditorPage.waitForSelector('#card-hobi');
      await cardEditorPage.click('#card-hobi');
      await cardEditorPage.keyboard.down('Control');
      await cardEditorPage.keyboard.press('A');
      await cardEditorPage.keyboard.up('Control');
      await cardEditorPage.type('#card-hobi', 'Hobi yang diperbarui');
      await cardEditorPage.waitForSelector('.card-editor-unsaved');
      await wait(50);
      await cardEditorPage.click('.tab[href="#/beranda"]');
      await wait(250);
      const restoredRoute = await cardEditorPage.evaluate(() => ({
        hash: window.location.hash,
        editorVisible: Boolean(document.querySelector('#card-hobi'))
      }));
      assert.deepEqual(
        restoredRoute,
        {hash: '#/card-saya', editorVisible: true},
        `Rejecting navigation should restore the editor, got ${JSON.stringify({
          ...restoredRoute,
          prompts: unsavedNavigationPrompts
        })}.`
      );
      assert.equal(
        unsavedNavigationPrompts,
        1,
        'Rejecting unsaved navigation restores the route without prompting again.'
      );
      assert.equal(cardEditorErrors.length, 0, 'Card editor should not raise browser errors.');
    } finally {
      await cardEditorPage.close();
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
