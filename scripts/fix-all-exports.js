/**
 * Fix exports.js files after split: remove IIFE tails, rewrite to SM.* refs.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function findExportsFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== 'node_modules') findExportsFiles(p, acc);
    } else if (name === 'exports.js') acc.push(p);
  }
  return acc;
}

function getNamespace(exportsPath) {
  const shared = path.join(path.dirname(exportsPath), 'shared.js');
  if (!fs.existsSync(shared)) return null;
  const s = fs.readFileSync(shared, 'utf8');
  const m = s.match(/window\['(__\w+)'\]/);
  return m ? m[1] : null;
}

for (const exp of findExportsFiles(path.join(root, 'js'))) {
  const ns = getNamespace(exp);
  if (!ns) continue;
  let content = fs.readFileSync(exp, 'utf8');
  const orig = content;

  // Remove IIFE closing tail
  content = content.replace(/\n\}\)\(typeof window[^\n]*\);\s*/g, '\n');

  // Keep only export block — if file has huge body (bad split), skip auto-trim
  const lines = content.split('\n');
  if (lines.length > 80) {
    console.warn('SKIP (too large, needs resplit):', path.relative(root, exp), lines.length, 'lines');
    continue;
  }

  if (!content.includes('var SM =')) {
    content = content.replace(
      /if \(typeof window !== 'undefined'\) \{/,
      "if (typeof window !== 'undefined') {\n  var SM = window['" + ns + "'];"
    );
  }

  // Rewrite window.x = funcName to SM.funcName when funcName is identifier
  content = content.replace(/window\.(\w+)\s*=\s*([a-zA-Z_]\w*);/g, (full, winName, fnName) => {
    if (fnName === winName || fnName === 'SM') return full;
    return `  window.${winName} = SM.${fnName};`;
  });

  // Bare window.x = at top level (no if block)
  if (!content.includes("if (typeof window !== 'undefined')")) {
    const assigns = [];
    const rest = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('window.') && t.includes('=') && !t.includes('SM.')) {
        const m = t.match(/window\.(\w+)\s*=\s*([a-zA-Z_]\w*);/);
        if (m) assigns.push(`  window.${m[1]} = SM.${m[2]};`);
      } else if (!t.startsWith('import ') && t !== '' && !t.startsWith('/**')) {
        rest.push(line);
      }
    }
    if (assigns.length) {
      content = `/** Public window exports */\nimport './part-1.js';\n\nif (typeof window !== 'undefined') {\n  var SM = window['${ns}'];\n${assigns.join('\n')}\n}\nexport {};\n`;
    }
  }

  // DOMContentLoaded init blocks — call via SM
  content = content.replace(/\binitUsers\(\)/g, "SM.initUsers()");
  content = content.replace(/document\.addEventListener\('DOMContentLoaded',\s*initUsers\)/g, "document.addEventListener('DOMContentLoaded', function () { SM.initUsers(); })");

  if (content !== orig) {
    fs.writeFileSync(exp, content);
    console.log('Fixed', path.relative(root, exp));
  }
}
