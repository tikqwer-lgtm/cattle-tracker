/**
 * Split monolithic JS into IIFE submodules under a folder.
 * Functions are registered on window[namespace]; cross-chunk calls use window[namespace].fn().
 *
 * node scripts/split-iife-module.js <sourceRel> <folderRel> <namespace> <chunkSize>
 * e.g. node scripts/split-iife-module.js js/features/stall-map.js js/features/stall-map __stallMap 320
 */
const fs = require('fs');
const path = require('path');

const [,, sourceRel, folderRel, namespace, chunkSizeStr] = process.argv;
if (!sourceRel || !folderRel || !namespace) {
  console.error('Usage: node split-iife-module.js <source> <folder> <namespace> [chunkSize=350]');
  process.exit(1);
}
const CHUNK = parseInt(chunkSizeStr || '350', 10);
const root = path.join(__dirname, '..');
const srcPath = path.join(root, sourceRel);
const folder = path.join(root, folderRel);
let src = fs.readFileSync(srcPath, 'utf8');
// Unwrap legacy IIFE wrapper (after optional header comments)
src = src.replace(
  /(\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*\(function\s*\([^)]*\)\s*\{\s*['"]use strict['"];\s*/m,
  (m) => m.replace(/\(function\s*\([^)]*\)\s*\{\s*['"]use strict['"];\s*$/, '')
);
src = src.replace(/\}\)\([^)]*\);\s*(\n\s*export\s*\{\s*\}\s*)?$/m, '\n');
const allLines = src.split('\n');
const esmImports = [];
const lines = [];
let inImport = false;
allLines.forEach((l) => {
  const t = l.trim();
  if (inImport || /^\s*import\s+/.test(l)) {
    esmImports.push(l);
    inImport = !t.includes(';') && !t.includes("from '") && !t.includes('from "');
    if (t.includes(';') || /from\s+['"]/.test(t)) inImport = false;
    return;
  }
  lines.push(l);
});

// Extract header (comments), state vars, and body
let startIdx = 0;
while (startIdx < lines.length) {
  const t = lines[startIdx].trim();
  if (t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t === '*/') {
    startIdx++;
    continue;
  }
  break;
}

const stateVarLines = [];
let bodyStart = startIdx;
for (let i = startIdx; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t.startsWith('import ')) continue;
  // Только однострочные простые инициализаторы — массивы/объекты остаются в теле
  if ((t.startsWith('var ') || t.startsWith('let ') || t.startsWith('const ')) && t.endsWith(';') && !t.includes('[') && !t.includes('{')) {
    stateVarLines.push(lines[i]);
    bodyStart = i + 1;
  } else if (t.startsWith('function ') || t.startsWith('if (typeof window')) {
    break;
  } else if (t === '') {
    bodyStart = i + 1;
  } else {
    break;
  }
}

// Find window export block end (before export {} or IIFE close)
let fileExportEnd = lines.length;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('export {}')) { fileExportEnd = i; continue; }
  if (lines[i].includes('})(typeof window')) { fileExportEnd = i; break; }
}

let exportStart = fileExportEnd;
for (let i = bodyStart; i < fileExportEnd; i++) {
  const t = lines[i].trim();
  if (t === "if (typeof window !== 'undefined') {" && i + 1 < fileExportEnd && lines[i + 1].includes('window.')) {
    exportStart = i;
    break;
  }
}
if (exportStart === fileExportEnd) {
  for (let i = fileExportEnd - 1; i >= bodyStart; i--) {
    const t = lines[i].trim();
    if (t.startsWith('window.') && t.includes('=')) {
      exportStart = i;
      while (exportStart > bodyStart && lines[exportStart - 1].trim().startsWith('window.')) exportStart--;
      break;
    }
  }
}

const bodyLines = lines.slice(bodyStart, exportStart);
let exportLines = lines.slice(exportStart, fileExportEnd).filter((l) => !l.includes('export {}'));
exportLines = exportLines.filter((l) => !l.includes('})(typeof window'));

// Parse top-level function names only (for cross-chunk rewrite)
const fnNames = [];
let scanDepth = 0;
bodyLines.forEach((l) => {
  const fm = scanDepth === 0 && l.match(/^\s*function (\w+)/);
  if (fm) fnNames.push(fm[1]);
  const stripped = l.replace(/\/\/.*$/, '').replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  for (const ch of stripped) {
    if (ch === '{') scanDepth++;
    else if (ch === '}') scanDepth = Math.max(0, scanDepth - 1);
  }
});

fs.mkdirSync(folder, { recursive: true });

// shared.js - state on window[namespace].state
const stateNames = stateVarLines.map((l) => {
  const m = l.match(/(?:var|let|const)\s+(\w+)/);
  return m ? m[1] : null;
}).filter(Boolean);

let shared = `/** Shared state: ${namespace} */\n(function () {\n  'use strict';\n`;
shared += `  var NS = typeof window !== 'undefined' ? (window['${namespace}'] = window['${namespace}'] || {}) : {};\n`;
shared += `  if (!NS.state) {\n    NS.state = {};\n`;
stateVarLines.forEach((l) => {
  const m = l.match(/(?:var|let|const)\s+(\w+)\s*=\s*(.+);?\s*$/);
  if (m) shared += `    NS.state.${m[1]} = ${m[2]};\n`;
});
shared += `  }\n})();\nexport {};\n`;
fs.writeFileSync(path.join(folder, 'shared.js'), shared);

function rewriteSegment(seg, localFns) {
  let l = seg;
  stateNames.forEach((n) => {
    l = l.replace(new RegExp('\\b' + n + '\\b', 'g'), `globalThis['${namespace}'].state.${n}`);
  });
  fnNames.forEach((fn) => {
    if (localFns.has(fn)) return;
    l = l.replace(new RegExp(`(?<!function\\s)\\b${fn}\\s*\\(`, 'g'), `globalThis['${namespace}'].${fn}(`);
  });
  return l;
}

function rewriteLine(line, localFns) {
  // Не переписывать внутри строковых литералов (onclick, HTML)
  const parts = line.split("'");
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = rewriteSegment(parts[i], localFns);
  }
  return parts.join("'");
}

// Split body into chunks at top-level function boundaries only (brace depth 0)
const chunks = [];
let current = [];
let currentFns = new Set();
let currentSize = 0;
let depth = 0;

function flushChunk() {
  if (!current.length) return;
  chunks.push({ lines: current, fns: new Set(currentFns) });
  current = [];
  currentFns = new Set();
  currentSize = 0;
}

function updateDepth(line) {
  const stripped = line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  for (const ch of stripped) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
  }
}

for (const line of bodyLines) {
  const fm = depth === 0 && line.match(/^\s*function (\w+)/);
  if (fm && currentSize >= CHUNK && current.length) {
    flushChunk();
  }
  current.push(line);
  if (fm) currentFns.add(fm[1]);
  currentSize++;
  updateDepth(line);
}
flushChunk();

const chunkFiles = [];
chunks.forEach((chunk, idx) => {
  const file = `part-${idx + 1}.js`;
  chunkFiles.push(file);
  const localFns = chunk.fns;
  let out = `/** ${namespace} part ${idx + 1} */\n(function () {\n  'use strict';\n  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);\n  var NS = root['${namespace}'] = root['${namespace}'] || {};\n  var global = root;\n\n`;
  chunk.lines.forEach((line) => {
    out += rewriteLine(line, localFns) + '\n';
  });
  out += '\n  // register functions\n';
  localFns.forEach((fn) => {
    out += `  NS.${fn} = ${fn};\n`;
  });
  out += '})();\nexport {};\n';
  fs.writeFileSync(path.join(folder, file), out);
  console.log('  ', file, chunk.lines.length, 'lines,', localFns.size, 'functions');
});

// exports.js
const folderName = path.basename(folderRel);
const importPrefix = './' + folderName + '/';
let exportsFile = `/** Public window exports */\n`;
// exports.js lives inside folder — only import last chunk (prior chunks loaded by facade)
exportsFile += `import './${chunkFiles[chunkFiles.length - 1]}';\n`;
exportsFile += '\n';
if (exportLines.length) {
  const rewritten = exportLines.map((line) => {
    if (!line.includes('window.') || line.includes('typeof window')) return line;
    return line.replace(/window\.(\w+)\s*=\s*(\w+);/, (full, winName, fnName) => {
      if (fnName === winName) return full;
      return `  window.${winName} = SM.${fnName};`;
    });
  });
  const hasSm = rewritten.some((l) => l.includes('var SM'));
  if (!hasSm) {
    const idx = rewritten.findIndex((l) => l.includes("if (typeof window"));
    if (idx >= 0) rewritten.splice(idx + 1, 0, `  var SM = window['${namespace}'];`);
  }
  exportsFile += rewritten.join('\n') + '\n';
}
exportsFile += 'export {};\n';
fs.writeFileSync(path.join(folder, 'exports.js'), exportsFile);

// Facade at original path (sibling to folder)
let facade = `/** Facade */\n`;
if (esmImports.length) {
  esmImports.forEach((imp) => { facade += imp + '\n'; });
}
facade += `import '${importPrefix}shared.js';\n`;
chunkFiles.forEach((f) => { facade += `import '${importPrefix}${f}';\n`; });
facade += `import '${importPrefix}exports.js';\nexport {};\n`;
fs.writeFileSync(srcPath, facade);

// backup
const bak = srcPath + '.orig';
if (!fs.existsSync(bak)) {
  fs.writeFileSync(bak, src);
}

console.log('Split', sourceRel, 'into', folderRel, '(', chunks.length, 'parts)');
