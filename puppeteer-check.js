const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const pages = ['index.html','siswa.html','guru.html','galeri.html','video.html','motto.html'];
const results = [];
(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox']});
  for (const p of pages) {
    const file = path.resolve(p);
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
      const ssPath = path.resolve('.puppeteer-screenshots', p + '.png');
      fs.mkdirSync(path.dirname(ssPath), {recursive:true});
      await page.screenshot({path:ssPath, fullPage:false});
      results.push({file:p, messages, screenshot:ssPath});
    } catch (err) {
      results.push({file:p, error: (err && err.message) || String(err), messages});
    }
    await page.close();
  }
  await browser.close();
  fs.writeFileSync('puppeteer-results.json', JSON.stringify(results, null, 2));
  console.log('Done. Results written to puppeteer-results.json');
})();
