const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/^part-\d+\.js$/.test(n)) {
      let s = fs.readFileSync(p, 'utf8');
      if (s.includes('global.') && !s.includes('var global')) {
        s = s.replace(
          /var NS = window\['(__\w+)'\];/,
          "var NS = window['$1'];\n  var global = typeof window !== 'undefined' ? window : this;"
        );
        fs.writeFileSync(p, s);
        console.log('fixed', path.relative(root, p));
      }
    }
  }
}
walk(path.join(root, 'js'));
