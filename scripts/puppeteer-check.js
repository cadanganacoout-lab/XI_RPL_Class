const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'reports');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
const pages = ['index.html','siswa.html','guru.html','galeri.html','video.html','komentar.html'];
const results = [];
(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox']});
  for (const p of pages) {
    const file = path.join(ROOT_DIR, p);
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
      const url = 'file://' + file;
      await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
      // wait a bit for any async runtime actions
      await page.waitForTimeout(500);
      // take a small screenshot for reference
      const ssPath = path.join(SCREENSHOT_DIR, p + '.png');
      fs.mkdirSync(path.dirname(ssPath), {recursive:true});
      await page.screenshot({path:ssPath, fullPage:false});
      results.push({file:p, messages, screenshot:ssPath});
    } catch (err) {
      results.push({file:p, error: (err && err.message) || String(err), messages});
    }
    await page.close();
  }
  await browser.close();
  fs.mkdirSync(REPORT_DIR, {recursive: true});
  fs.writeFileSync(path.join(REPORT_DIR, 'puppeteer-results.json'), JSON.stringify(results, null, 2));
  console.log('Done. Results written to reports/puppeteer-results.json');
})();
