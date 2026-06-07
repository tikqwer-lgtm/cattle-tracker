const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.js')) {
      let s = fs.readFileSync(p, 'utf8');
      const n2 = s.replace(/window\['(__\w+)'\]/g, "globalThis['$1']");
      if (n2 !== s) {
        fs.writeFileSync(p, n2);
        console.log(path.relative(root, p));
      }
    }
  }
}
walk(path.join(root, 'js'));
