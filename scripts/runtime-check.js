const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const entryFile = "index.html";
const results = [];

async function run() {
  const htmlFiles = fs.readdirSync(ROOT_DIR)
    .filter(file => file.endsWith(".html"))
    .sort();
  if (htmlFiles.length !== 1 || htmlFiles[0] !== entryFile) {
    results.push({
      file: "HTML entries",
      error: `Expected only ${entryFile}, found: ${htmlFiles.join(", ") || "none"}.`,
    });
  }

  const abs = path.join(ROOT_DIR, entryFile);
  if (!fs.existsSync(abs)) {
    results.push({ file: entryFile, error: "HTML entry point is missing." });
  } else {
    const messages = [];
    const virtualConsole = new VirtualConsole();
    for (const method of ["warn", "error"]) {
      virtualConsole.on(method, (...args) => {
        messages.push({
          type: method,
          text: args.map(value => String(value)).join(" "),
        });
      });
    }
    const dom = await JSDOM.fromFile(abs, {
      runScripts: "outside-only",
      virtualConsole,
    });
    dom.window.eval(fs.readFileSync(path.join(ROOT_DIR, "js/data.js"), "utf8"));

    const document = dom.window.document;
    const missing = [];
    if (!document.getElementById("root")) missing.push("#root");
    if (!document.querySelector('script[type="module"][src$="/src/main.jsx"]')) {
      missing.push("React entry script");
    }
    if (!document.querySelector('script[src$="js/data.js"]')) missing.push("js/data.js");
    if (!document.querySelector('link[rel="stylesheet"][href$="css/style.css"]')) {
      missing.push("css/style.css");
    }

    const data = dom.window.XIRPL1_DATA;
    if (!data) {
      missing.push("window.XIRPL1_DATA");
    } else {
      for (const key of ["SISWA", "GURU", "GALERI", "VIDEO"]) {
        if (!Array.isArray(data[key])) {
          messages.push({ type: "error", text: `${key} must be an array.` });
          continue;
        }
        const ids = data[key].map(item => item.id).filter(Boolean);
        if (new Set(ids).size !== ids.length) {
          messages.push({ type: "error", text: `IDs in ${key} must be unique.` });
        }
      }
      if (data.GALERI.length === 0) {
        messages.push({
          type: "error",
          text: "Galeri minimal harus memiliki satu foto.",
        });
      }
    }

    results.push({ file: entryFile, msgs: messages, missingIds: missing });
    dom.window.close();
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, "runtime-output.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.error ||
    (result.missingIds || []).length ||
    (result.msgs || []).some(message => message.type === "error"))) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error("FATAL", error && error.stack ? error.stack : error);
  process.exit(2);
});
