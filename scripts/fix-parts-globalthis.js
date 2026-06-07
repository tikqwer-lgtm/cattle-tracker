const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/^(part-\d+|shared)\.js$/.test(n)) {
      let s = fs.readFileSync(p, 'utf8');
      if (s.includes("window['__") && !s.includes('globalThis')) {
        s = s.replace(
          /var NS = window\['(__\w+)'\];/g,
          "var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);\n  var NS = root['$1'] = root['$1'] || {};"
        );
        s = s.replace(
          /var NS = typeof window !== 'undefined' \? \(window\['(__\w+)'\] = window\['\1'\] \|\| \{\}\) : \{\};/g,
          "var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);\n  var NS = root['$1'] = root['$1'] || {};"
        );
        if (!s.includes('var global =')) {
          s = s.replace(/var NS = root\['(__\w+)'\][^\n]+\n/, (m) => m + '  var global = root;\n');
        }
        fs.writeFileSync(p, s);
        console.log('fixed', path.relative(root, p));
      }
    }
  }
}
walk(path.join(root, 'js'));
