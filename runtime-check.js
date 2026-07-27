const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const htmlFiles = ['index.html','siswa.html','guru.html','galeri.html','video.html','motto.html'];
const results = [];

async function run() {
  for (const file of htmlFiles) {
    if (!fs.existsSync(file)) continue;
    const abs = path.resolve(file);
    const msgs = [];
    const dom = await JSDOM.fromFile(abs, {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole: new (require('jsdom').VirtualConsole)()
    });

    const vcon = dom.window.console;
    // capture console methods
    ['log','warn','error','info'].forEach(m => {
      const orig = vcon[m] ? vcon[m].bind(vcon) : () => {};
      vcon[m] = (...args) => {
        msgs.push({type: m, text: args.map(a => (typeof a==='string'?a:JSON.stringify(a))).join(' ')});
        orig(...args);
      };
    });

    // window error
    dom.window.addEventListener('error', (ev) => {
      msgs.push({type: 'error', text: ev.message || String(ev.error || ev)});
    });

    // also capture unhandledrejection
    dom.window.addEventListener('unhandledrejection', (ev) => {
      msgs.push({type: 'error', text: ev.reason ? (ev.reason.message || String(ev.reason)) : 'unhandledrejection'});
    });

    // wait for resources to load or timeout
    await new Promise(resolve => setTimeout(resolve, 800));

    // collect any DOM queries in script.js that may have returned null earlier
    // (not exhaustive) Check known ids from script.js
    const ids = [
      'themeToggle','menuToggle','tabbar','terminalBody','marqueeTrack','jadwalList','piketList',
      'statSiswaHero','statGuruHero','siswaSearch','siswaGrid','siswaCount','guruSearch','guruGrid','guruCount',
      'galeriGrid','videoGrid','mottoStage','globalModal','globalModalBox','todayBadge'
    ];
    const missingIds = ids.filter(id => dom.window.document.getElementById(id) === null);

    results.push({file, msgs, missingIds});

    // cleanup
    dom.window.close && dom.window.close();
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('FATAL', err && err.stack ? err.stack : err);
  process.exit(2);
});
