const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'reports');
const pageIds = {
  'index.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'terminalBody', 'marqueeTrack',
    'jadwalList', 'piketList', 'statSiswaHero', 'statGuruHero', 'todayBadge',
    'globalModal', 'globalModalBox', 'homeCommentsList', 'homeCommentsStatus'
  ],
  'siswa.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'siswaSearch', 'siswaGrid',
    'siswaCount', 'globalModal', 'globalModalBox'
  ],
  'guru.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'guruSearch', 'guruGrid',
    'guruCount', 'globalModal', 'globalModalBox'
  ],
  'galeri.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'galeriGrid',
    'globalModal', 'globalModalBox'
  ],
  'video.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'videoGrid',
    'globalModal', 'globalModalBox'
  ],
  'komentar.html': [
    'themeToggle', 'menuToggle', 'tabbar', 'commentForm', 'commentInput',
    'commentsList', 'commentNotice', 'commentConnectionStatus', 'loadOlderComments',
    'replyingTo', 'replyingToText', 'cancelReply', 'commentSubmit',
    'globalModal', 'globalModalBox'
  ]
};
const htmlFiles = Object.keys(pageIds);
const results = [];

async function run() {
  for (const file of htmlFiles) {
    const abs = path.join(ROOT_DIR, file);
    if (!fs.existsSync(abs)) continue;
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

    const missingIds = pageIds[file]
      .filter(id => dom.window.document.getElementById(id) === null);

    results.push({file, msgs, missingIds});

    // cleanup
    dom.window.close && dom.window.close();
  }

  fs.mkdirSync(REPORT_DIR, {recursive: true});
  fs.writeFileSync(path.join(REPORT_DIR, 'runtime-output.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('FATAL', err && err.stack ? err.stack : err);
  process.exit(2);
});
