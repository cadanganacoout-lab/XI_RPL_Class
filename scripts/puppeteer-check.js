const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildLegacyCards, loadLegacyStudents } = require('./migrate-legacy');
const { loadLegacyTeachers } = require('./migrate-teachers');
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
const browserTeachers = loadLegacyTeachers().map((teacher, index) => ({
  ...teacher,
  sortOrder: index + 1
}));
const browserPhotos = Array.from({length: 10}, (_, index) => ({
  id: `browser-photo-${index + 1}`,
  caption: `Foto database ${index + 1}`,
  url: `https://images.example.test/photos/${index + 1}.svg`,
  sortOrder: index + 1
}));

async function mockSiteApi(page, {
  includeGallery = false,
  includeComments = false,
  user = null,
  galleryDelay = 0,
  imageDelay = 0
} = {}) {
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/auth/me') {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({user})
      });
    }
    if (pathname === '/api/comments/report' && includeComments) {
      return request.respond({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ok: true})
      });
    }
    if (pathname === '/api/comments/reports' && includeComments) {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reports: [{
            id: 'a'.repeat(24),
            commentId: 17,
            commentContent: 'Komentar untuk ditinjau admin',
            reason: 'spam',
            reportCount: 1,
            status: 'pending',
            createdAt: new Date().toISOString()
          }]
        })
      });
    }
    if (pathname === '/api/cards') {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({cards: browserCards})
      });
    }
    if (pathname === '/api/teachers') {
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({teachers: browserTeachers})
      });
    }
    if (pathname === '/api/gallery' && includeGallery) {
      if (galleryDelay) await wait(galleryDelay);
      return request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({photos: browserPhotos})
      });
    }
    if (includeComments && pathname.endsWith('/supabase-config.js')) {
      return request.respond({
        status: 200,
        contentType: 'application/javascript',
        body: `window.SUPABASE_CONFIG = {url: 'https://supabase.example.test', anonKey: 'browser-test-key'};`
      });
    }
    if (includeComments && request.url().includes('@supabase/supabase-js')) {
      return request.respond({
        status: 200,
        contentType: 'application/javascript',
        body: `window.supabase = {
          createClient() {
            const rows = [{
              id: 17,
              content: 'Komentar yang bisa dilaporkan',
              parent_id: null,
              created_at: new Date().toISOString(),
              author_name: null
            }];
            return {
              from() {
                return {
                  select() {
                    return {
                      order() {
                        return {limit: async () => ({data: rows, error: null})};
                      }
                    };
                  }
                };
              },
              channel() {
                return {
                  on() { return this; },
                  subscribe(callback) {
                    setTimeout(() => callback('SUBSCRIBED'), 0);
                    return this;
                  }
                };
              },
              removeChannel() {}
            };
          }
        };`
      });
    }
    if (request.url().startsWith('https://images.example.test/photos/')) {
      if (imageDelay) await wait(imageDelay);
      const color = ['#e5a84b', '#73c9b2', '#a795f5', '#e78ba1'][Number(pathname.match(/\d+/)?.[0] || 1) % 4];
      return request.respond({
        status: 200,
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 16 9"><rect width="16" height="9" fill="${color}"/></svg>`
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
      let stage = 'page load';
      await mockSiteApi(page, {
        includeGallery: route === 'beranda',
        includeComments: route === 'komentar',
        user: route === 'komentar'
          ? {username: 'admin', displayName: 'Admin Utama', role: 'admin'}
          : null,
        galleryDelay: route === 'beranda' ? 500 : 0,
        imageDelay: route === 'beranda' ? 5000 : 0
      });

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
        const routeHash = route === 'video' ? '/video?id=v02' : `/${route}`;
        const url = `http://127.0.0.1:${address.port}/index.html#${routeHash}`;
        await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000});
        await page.waitForSelector('#root > *', {timeout: 10000});
        if (route === 'beranda') {
          assert.ok(await page.$('.welcome-gallery-loading'), 'Welcome gallery shows skeletons while database photos load.');
          assert.equal(
            await page.$$eval('.gallery-highlight-card--skeleton', cards => cards.length),
            8,
            'Gallery spotlights reserve their layout while database photos load.'
          );
        }
        await wait(250);
        stage = 'mobile touch-hover check';
        const mobileHoverTargets = {
          beranda: '.welcome-gallery',
          siswa: '.people-card',
          guru: '.people-card',
          galeri: '.gallery-item',
          video: '.video-card',
          komentar: 'textarea[maxlength="500"]'
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
          if (route === 'siswa' || route === 'guru') {
            assert.equal(
              await page.$eval('.nav-picker[data-group="pages"] .nav-picker-trigger.active', trigger => trigger.dataset.page),
              route
            );
            assert.equal(
              await page.$eval(`.nav-picker[data-group="pages"] .nav-picker-link[data-page="${route}"]`, link => link.getAttribute('href')),
              `#/${route}`
            );
          } else {
            assert.equal(
              await page.$('.nav-picker[data-group="pages"] .nav-picker-trigger.active'),
              null,
              `${route} has no active explore navigation item.`
            );
          }
          if (route === 'siswa' || route === 'guru') {
          const expectedCount = await page.evaluate(() => {
            const data = window.XIRPL1_DATA;
            return document.body.dataset.page === 'guru'
              ? data.GURU.length
              : data.SISWA.length;
          });
          assert.equal(await page.$$eval('.people-card', cards => cards.length), expectedCount);
          assert.equal((await page.$$('.people-empty')).length, 0, 'Profile cards do not repeat incomplete-profile placeholders.');
          assert.equal((await page.$$('.portfolio-link[disabled]')).length, 0, 'Unavailable portfolio links are omitted.');
          assert.ok((await page.$$('.people-page-note')).length <= 1, 'Incomplete profile guidance appears at most once per page.');
          assert.equal(
            await page.$eval('.nav-picker[data-group="pages"] .nav-picker-trigger.active', trigger => trigger.dataset.page),
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
            assert.ok(await page.$('#video-v02.is-selected iframe[title]'), 'A selected highlight opens and plays its matching video.');
            await page.click('.video-play');
            assert.ok(await page.$('.video-frame iframe[title]'), 'Playing a video loads an embed with an accessible title.');
          } else if (route === 'beranda') {
            stage = 'welcome and navbar checks';
            assert.ok(await page.$('.hero-beranda'), 'Home page renders the class hero.');
            assert.equal(await page.$('.agenda-card--duty .duty-count'), null, 'Empty duty schedules do not show a student count.');
            assert.equal(await page.$('.agenda-card--duty .duty-list'), null, 'PKL messages are not rendered as duty names.');
            assert.match(
              await page.$eval('.agenda-card--duty .agenda-empty', message => message.textContent),
              /PKL|Tidak ada jadwal piket/,
              'No-duty state is announced without showing an incorrect student count.'
            );
            assert.match(
              await page.$eval('.agenda-card--schedule .empty-note', message => message.textContent),
              /PKL|Tidak ada jadwal pelajaran/,
              'Empty schedule state remains clear.'
            );
            await page.waitForSelector(
              '.welcome-gallery-tile.is-image-loading .welcome-gallery-tile-skeleton',
              {timeout: 10000}
            );
            await page.waitForSelector('.gallery-highlight-card img', {timeout: 10000});
            await page.evaluate(() => document.getElementById('gallery-spotlight').scrollIntoView({
              block: 'center',
              behavior: 'instant'
            }));
            await page.waitForSelector(
              '.gallery-highlight-card.is-image-loading .home-photo-skeleton',
              {timeout: 10000}
            );
            await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
            assert.ok(await page.$('.welcome-gallery-tile img'), 'Welcome hero renders gallery photos.');
            await page.waitForSelector('.welcome-gallery-tile.is-image-ready', {timeout: 10000});
            assert.equal(await page.$('.welcome-actions'), null, 'Welcome hero has no action buttons.');
            await page.waitForFunction(
              () => getComputedStyle(document.querySelector('.site-header')).visibility === 'hidden',
              {timeout: 5000}
            );
            assert.equal(
              await page.$eval('.site-header', header => getComputedStyle(header).visibility),
              'hidden',
              'The main navigation stays hidden while the welcome hero is in view.'
            );
            const welcomeLayout = await page.evaluate(() => ({
              title: document.querySelector('#welcome-title').getBoundingClientRect().top,
              gallery: document.querySelector('.welcome-gallery').getBoundingClientRect().top,
              slogan: document.querySelector('.welcome-tagline').getBoundingClientRect().top
            }));
            assert.ok(
              welcomeLayout.title < welcomeLayout.gallery &&
                welcomeLayout.gallery < welcomeLayout.slogan,
              'Welcome title, photo arc, and class slogan appear in order.'
            );
            assert.equal(await page.$('.class-lineup'), null, 'Home page does not render the class structure section.');
            const gallerySources = await page.$$eval(
              '.gallery-highlight-card img',
              images => images.map(image => image.getAttribute('src'))
            );
            assert.equal(gallerySources.length, 8, 'Home page renders eight landscape gallery highlights.');
            assert.equal(new Set(gallerySources).size, 8, 'Gallery highlights use distinct photos.');
            assert.ok(
              gallerySources.every(source => browserPhotos.some(photo => photo.url === source)),
              'Gallery highlights use only photos returned by the database API.'
            );
            const welcomeSources = await page.$$eval(
              '.welcome-gallery-tile img',
              images => [...new Set(images.map(image => image.getAttribute('src')))]
            );
            assert.ok(
              welcomeSources.length > 0 &&
                welcomeSources.every(source => browserPhotos.some(photo => photo.url === source)),
              'Welcome hero uses only photos returned by the database API.'
            );
            assert.equal(await page.$('.gallery-highlight-stage .route-label'), null, 'Gallery highlights show only the section title.');
            assert.equal(
              await page.evaluate(() => {
                const title = document.querySelector('#gallery-spotlight-title').getBoundingClientRect();
                return [...document.querySelectorAll('.gallery-highlight-card')].some(card => {
                  const bounds = card.getBoundingClientRect();
                  return bounds.left < title.right && bounds.right > title.left &&
                    bounds.top < title.bottom && bounds.bottom > title.top;
                });
              }),
              false,
              'Gallery photos stay clear of the section title.'
            );
            const videoCards = await page.$$eval('.video-highlight-card', cards => cards.map(card => ({
              href: card.getAttribute('href'),
              title: card.querySelector('strong')?.textContent.trim(),
              poster: card.querySelector('img')?.getAttribute('src')
            })));
            assert.equal(videoCards.length, 9, 'Video spotlight shows nine representative thumbnails.');
            assert.equal(
              new Set(videoCards.map(card => card.href)).size,
              9,
              'Each video card links to a distinct video.'
            );
            assert.ok(
              videoCards.every(card => card.href?.startsWith('#/video?id=') && card.title && card.poster),
              'Video cards keep their titles, posters, and direct playback links.'
            );
            await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'no-preference'}]);
            assert.equal(
              await page.$eval('.video-highlight-card', card => getComputedStyle(card).animationName),
              'spotlight-card-enter',
              'Spotlight cards use a staggered entrance animation.'
            );
            await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
            assert.equal(
              await page.$eval('.video-highlight-card', card => getComputedStyle(card).animationName),
              'none',
              'Spotlight entrance motion respects reduced-motion preferences.'
            );
            await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'no-preference'}]);
            assert.deepEqual(
              await page.$$eval('.nav-picker-trigger', triggers => triggers.map(trigger => trigger.textContent.trim())),
              ['Home', 'Jelajahi'],
              'The main navigation groups home links separately from page links.'
            );
            assert.deepEqual(
              await page.$$eval('.nav-picker[data-group="home"] .nav-picker-link', links => links.map(link => link.textContent.trim())),
              ['Beranda', 'Sorotan Galeri', 'Sorotan Video', 'Jadwal', 'Footer'],
              'The home menu links to its sections and footer.'
            );
            assert.deepEqual(
              await page.$$eval('.nav-picker[data-group="pages"] .nav-picker-link', links => links.map(link => link.textContent.trim())),
              ['Siswa', 'Guru', 'Masuk', 'Daftar'],
              'The explore menu includes students, teachers, login, and registration.'
            );
            await page.evaluate(() => {
              const hero = document.querySelector('.welcome-hero');
              window.scrollTo({
                top: window.scrollY + hero.getBoundingClientRect().bottom + 1,
                behavior: 'instant'
              });
            });
            await page.waitForFunction(
              () => getComputedStyle(document.querySelector('.site-header')).visibility === 'visible',
              {timeout: 5000}
            );
            assert.equal(
              await page.$eval('.site-header', header => getComputedStyle(header).visibility),
              'visible',
              'The main navigation appears after scrolling past the welcome hero.'
            );
            assert.equal((await page.$$('.stat-card')).length, 3);
            assert.ok(await page.$('.agenda-card--schedule'), 'Home page renders the schedule dashboard.');
            assert.ok(await page.$('.agenda-card--duty'), 'Home page renders the duty dashboard.');
            assert.equal((await page.$$('.agenda-day-button')).length, 2);
            const currentDay = await page.$eval('.agenda-card--duty .agenda-eyebrow', node => node.textContent);
            stage = 'agenda schedule button';
            await page.$eval('.agenda-day-button:nth-child(2)', button => button.scrollIntoView({
              block: 'center',
              behavior: 'instant'
            }));
            await wait(50);
            await page.click('.agenda-day-button:nth-child(2)');
            await page.waitForFunction(
              () => document.querySelector('.agenda-day-button:nth-child(2)').getAttribute('aria-pressed') === 'true',
              {timeout: 2000}
            );
            const tomorrowState = await page.evaluate(() => ({
              pressed: document.querySelector('.agenda-day-button:nth-child(2)').getAttribute('aria-pressed'),
              chatOpen: document.querySelector('#global-chat-dialog').open,
              activeElement: document.activeElement.className
            }));
            assert.equal(
              tomorrowState.pressed,
              'true',
              `Selecting tomorrow activates its schedule button: ${JSON.stringify(tomorrowState)}`
            );
            assert.notEqual(
              await page.$eval('.agenda-card--duty .agenda-eyebrow', node => node.textContent),
              currentDay,
              'Selecting tomorrow updates the duty schedule.'
            );
            await page.click('.agenda-day-button:first-child');
            stage = 'home navigation section link';
            await page.click('.nav-picker[data-group="home"] summary');
            await page.click('.nav-picker[data-group="home"] a[href*="section=video-spotlight"]');
            stage = 'home navigation hash change';
            await page.waitForFunction(
              () => window.location.hash === '#/beranda?section=video-spotlight',
              {timeout: 3000}
            );
            stage = 'home navigation focus target';
            await page.waitForFunction(
              () => document.activeElement.id === 'video-spotlight',
              {timeout: 3000}
            );
            const footerLinks = await page.evaluate(() => {
              const {UI} = window.XIRPL1_DATA;
              return {
                classWebsite: UI.links.class.website,
                classSocial: [
                  [UI.footer.youtubeLabel, UI.links.class.youtube],
                  [UI.footer.tiktokLabel, UI.links.class.tiktok],
                  [UI.footer.instagramLabel, UI.links.class.instagram]
                ],
                schoolWebsite: UI.links.school.website,
                schoolSocial: [
                  [UI.footer.schoolYoutubeLabel, UI.links.school.youtube],
                  [UI.footer.schoolTiktokLabel, UI.links.school.tiktok],
                  [UI.footer.schoolInstagramLabel, UI.links.school.instagram]
                ]
              };
            });
            assert.deepEqual(
              await page.$$eval('.footer-link-group[data-group="class"] .footer-links a', links => (
                links.map(link => [link.textContent.trim(), link.getAttribute('href')])
              )),
              [['Website Kelas', footerLinks.classWebsite]],
              'The class footer group links only to the class website.'
            );
            assert.deepEqual(
              await page.$$eval('.footer-link-group[data-group="class"] .footer-social-link', links => (
                links.map(link => [link.getAttribute('aria-label'), link.getAttribute('href')])
              )),
              footerLinks.classSocial,
              'The class footer group links to its social channels.'
            );
            assert.deepEqual(
              await page.$$eval('.footer-link-group[data-group="school"] .footer-links a', links => (
                links.map(link => [link.textContent.trim(), link.getAttribute('href')])
              )),
              [['Website sekolah', footerLinks.schoolWebsite]],
              'The school website is separate from class links.'
            );
            assert.deepEqual(
              await page.$$eval('.footer-link-group[data-group="school"] .footer-social-link', links => (
                links.map(link => [link.getAttribute('aria-label'), link.getAttribute('href')])
              )),
              footerLinks.schoolSocial,
              'The school footer group links to its social channels.'
            );
            await page.click('.nav-picker[data-group="home"] summary');
            await page.click('.nav-picker[data-group="home"] a[href*="section=site-footer"]');
            await page.waitForFunction(
              () => window.location.hash === '#/beranda?section=site-footer' &&
                document.activeElement.id === 'site-footer',
              {timeout: 3000}
            );
            await page.waitForFunction(
              () => document.querySelector('.footer-wordmark').classList.contains('is-revealed'),
              {timeout: 3000}
            );
            assert.deepEqual(
              await page.$eval('.footer-wordmark-letter', letter => {
                const animation = getComputedStyle(letter);
                return [animation.animationDuration, animation.animationIterationCount];
              }),
              ['6.62s', 'infinite'],
              'The footer wordmark appears, holds for six seconds, then repeats.'
            );
          } else if (route === 'komentar') {
            assert.equal(
              await page.$eval('#global-chat-dialog', dialog => dialog.open),
              true,
              'The legacy discussion route opens the global chat dialog.'
            );
            assert.ok(await page.$('textarea[maxlength="500"]'), 'Comment form enforces the 500 character limit.');
            await page.type('#commentInput', 'Tes komentar');
            assert.equal(await page.$eval('.comment-form-footer span', node => node.textContent), '12/500');
              await page.waitForSelector('.comment-card');
              await page.click('.comment-report-button');
              assert.equal(
                await page.$eval('.comment-report-form', form => form.hidden),
                false,
                'The report button reveals its labeled form.'
              );
              await page.select('#report-reason-17', 'spam');
              await page.click('#report-comment-17 button[type="submit"]');
              await page.waitForFunction(
                () => document.querySelector('.comment-report-notice')?.textContent.includes('Laporan terkirim'),
                {timeout: 3000}
              );
              await page.waitForSelector('.comment-report-queue');
              assert.ok(await page.$('.comment-report-item blockquote'), 'The admin report queue includes the reported comment.');
          }

          stage = 'global chat dialog';
          assert.ok(await page.$('.global-chat-trigger'), 'The global chat trigger is available on every route.');
          if (route !== 'komentar') {
            await page.click('.global-chat-trigger');
          }
          await page.waitForFunction(() => document.querySelector('#global-chat-dialog').open);
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('#global-chat-dialog').open);
          assert.equal(
            await page.evaluate(() => document.activeElement.classList.contains('global-chat-trigger')),
            true,
            'Closing the chat returns focus to its trigger.'
          );

          await page.setViewport({width: 390, height: 844});
          if (route === 'beranda') {
            await page.evaluate(() => {
              const hero = document.querySelector('.welcome-hero');
              window.scrollTo({
                top: window.scrollY + hero.getBoundingClientRect().bottom + 1,
                behavior: 'instant'
              });
            });
            await wait(100);
          }
          stage = 'mobile layout check';
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
          stage = 'mobile navigation menu';
          await page.click('.menu-toggle');
          assert.equal(
            await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')),
            'true',
            `${route} menu button should open the navigation.`
          );
          assert.ok(await page.$eval('.tabbar', nav => nav.classList.contains('open')));
          await page.click('.menu-toggle');
          assert.equal(await page.$eval('.menu-toggle', button => button.getAttribute('aria-expanded')), 'false');
          const previousTheme = await page.$eval('.theme-toggle', button => button.getAttribute('aria-pressed'));
          const footerBackground = await page.$eval(
            '.site-footer',
            footer => getComputedStyle(footer).backgroundColor
          );
          stage = 'theme toggle';
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
        results.push({file:route, error: `${stage}: ${(err && err.message) || String(err)}`, messages});
      }
      await page.close();
    }

    const mobileBackgroundPage = await browser.newPage();
    await mobileBackgroundPage.setViewport({width: 390, height: 844});
    await mobileBackgroundPage.setRequestInterception(true);
    mobileBackgroundPage.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/auth/me') {
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {username: 'browser_student', displayName: 'Browser Student', role: 'student'}
          })
        });
      }
      if (pathname === '/api/cards/me') {
        const background = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'%3E%3Crect width='100%25' height='100%25' fill='blue'/%3E%3C/svg%3E";
        return request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            card: {
              id: 's01',
              nama: 'Browser Student',
              jabatan: 'Siswa',
              hobi: '',
              catatan: '',
              foto: '',
              avatar: null,
              background: {url: background},
              portfolio: ''
            }
          })
        });
      }
      return request.continue();
    });
    try {
      await mobileBackgroundPage.goto(
        `http://127.0.0.1:${address.port}/index.html#/card-saya`,
        {waitUntil: 'domcontentloaded', timeout: 30000}
      );
      await mobileBackgroundPage.waitForSelector('.media-uploader-preview--background img');
      const backgroundPreviewBounds = await mobileBackgroundPage.evaluate(() => {
        const preview = document.querySelector('.media-uploader-preview--background');
        const image = preview.querySelector('img');
        const uploader = preview.closest('.media-uploader');
        const uploaderBounds = uploader.getBoundingClientRect();
        const previewBounds = preview.getBoundingClientRect();
        const imageBounds = image.getBoundingClientRect();
        const overflowingContents = [...uploader.querySelectorAll('small, input[type="file"]')]
          .map(element => ({
            selector: element.tagName.toLowerCase() +
              (element.type ? `[type="${element.type}"]` : ''),
            right: element.getBoundingClientRect().right,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth
          }))
          .filter(element =>
            element.right > uploaderBounds.right + 1 ||
            element.scrollWidth > element.clientWidth + 1
          );
        return {
          uploaderRight: uploaderBounds.right,
          previewRight: previewBounds.right,
          imageRight: imageBounds.right,
          imageWidth: imageBounds.width,
          previewWidth: previewBounds.width,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          naturalImageWidth: image.naturalWidth,
          overflowingContents
        };
      });
      assert.equal(backgroundPreviewBounds.naturalImageWidth, 1200);
      assert.ok(
        backgroundPreviewBounds.previewRight <= backgroundPreviewBounds.uploaderRight,
        `Background preview frame should stay within its uploader on mobile: ${JSON.stringify(backgroundPreviewBounds)}`
      );
      assert.ok(
        backgroundPreviewBounds.imageWidth <= backgroundPreviewBounds.previewWidth + 1,
        `Background preview image should stay within its frame on mobile: ${JSON.stringify(backgroundPreviewBounds)}`
      );
      assert.ok(
        backgroundPreviewBounds.documentWidth <= backgroundPreviewBounds.viewportWidth,
        `Card editor should not overflow horizontally on mobile: ${JSON.stringify(backgroundPreviewBounds)}`
      );
      assert.deepEqual(
        backgroundPreviewBounds.overflowingContents,
        [],
        `Upload helper text and file control should stay within the uploader on mobile: ${JSON.stringify(backgroundPreviewBounds)}`
      );
      results.push({file: 'card-editor-background-mobile', backgroundPreviewBounds});
    } finally {
      await mobileBackgroundPage.close();
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
      await cardEditorPage.click('.brand[href="#/beranda"]');
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
