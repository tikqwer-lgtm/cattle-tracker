const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (n === 'exports.js') acc.push(p);
  }
  return acc;
}

for (const exp of walk(path.join(root, 'js'))) {
  const shared = path.join(path.dirname(exp), 'shared.js');
  if (!fs.existsSync(shared)) continue;
  const ns = (fs.readFileSync(shared, 'utf8').match(/window\['(__\w+)'\]/) || [])[1];
  if (!ns) continue;

  let lines = fs.readFileSync(exp, 'utf8').split('\n');
  // If exports file is bloated (>60 lines), extract only window assignment lines
  const assignLines = lines.filter((l) => /^\s*window\.\w+\s*=\s*\w+;/.test(l.trim()) || /window\.\w+\s*=\s*SM\./.test(l));
  const hasBloat = lines.length > 60 && assignLines.length < lines.length / 2;

  if (hasBloat && assignLines.length) {
    const out = [
      '/** Public window exports */',
      "import './part-3.js';",
      '',
      "if (typeof window !== 'undefined') {",
      `  var SM = window['${ns}'];`,
    ];
    assignLines.forEach((l) => {
      const m = l.trim().match(/window\.(\w+)\s*=\s*(\w+);/);
      if (m && m[2] !== 'SM') out.push(`  window.${m[1]} = SM.${m[2]};`);
      else if (l.includes('SM.')) out.push('  ' + l.trim());
    });
    out.push('}', 'export {};', '');
    fs.writeFileSync(exp, out.join('\n'));
    console.log('Rebuilt', path.relative(root, exp));
    continue;
  }

  let content = lines.join('\n');
  content = content.replace(/\n\}\)\(typeof window[^\n]*\);\s*/g, '\n');
  content = content.replace(/window\.(\w+)\s*=\s*([a-zA-Z_]\w*);/g, (f, w, fn) => {
    if (fn === w || fn === 'SM') return f;
    return `window.${w} = SM.${fn};`;
  });
  // Повтор для строк без SM
  content = content.replace(/window\.(\w+)\s*=\s*([a-zA-Z_]\w*);/g, (f, w, fn) => {
    if (fn === w || fn === 'SM') return f;
    return `window.${w} = SM.${fn};`;
  });
  if (!content.includes('var SM =')) {
    content = content.replace(/if \(typeof window !== 'undefined'\) \{/, `if (typeof window !== 'undefined') {\n  var SM = window['${ns}'];`);
  }
  // Remove node module.exports from exports.js
  content = content.replace(/\n\/\/ Экспорт функций[\s\S]*?module\.exports[\s\S]*?\}\n/g, '\n');
  fs.writeFileSync(exp, content);
  console.log('Patched', path.relative(root, exp));
}
