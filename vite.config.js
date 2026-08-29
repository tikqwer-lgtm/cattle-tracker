/**
 * Vite: production — один IIFE-бандл dist/app.js (Electron/Capacitor/file://).
 * Dev — HTML entry + /js/main.tsx как module (HMR / Fast Refresh).
 */
const path = require('path');
const fs = require('fs');
const tailwindcss = require('@tailwindcss/vite').default;
const react = require('@vitejs/plugin-react').default;

function copyDirSync(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function viteDevHtmlPlugin() {
  return {
    name: 'vite-dev-html-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html;
        return html.replace(
          /<script src="dist\/app\.js"><\/script>/,
          '<script type="module" src="/js/main.tsx"></script>'
        );
      }
    }
  };
}

function viteDistCopyPlugin() {
  const root = path.resolve(__dirname);
  return {
    name: 'vite-dist-copy',
    configureServer(server) {
      server.middlewares.use(function (req, res, next) {
        const url = String((req && req.url) || '').split('?')[0];
        if (url !== '/templates/act-uslug.docx') return next();
        const file = path.join(root, 'assets', 'templates', 'act-uslug.docx');
        if (!fs.existsSync(file)) return next();
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const distDir = path.join(root, 'dist');
      if (!fs.existsSync(distDir)) return;
      const indexPath = path.join(root, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/src="dist\/app\.js"/g, 'src="app.js"');
        html = html.replace(/href="dist\/app\.css"/g, 'href="app.css"');
        html = html.replace(/<link\s+rel="stylesheet"\s+href="css\/print\.css"[^>]*>\s*/g, '');
        html = html.replace(/<link\s+rel="stylesheet"\s+href="css\/style\.css"[^>]*>\s*/g, '');
        if (!html.includes('src="app.js"') && !html.includes("src='app.js'")) {
          html = html.replace('</body>', '<script src="app.js"></script>\n</body>');
        }
        fs.writeFileSync(path.join(distDir, 'index.html'), html);
      }
      for (const dir of ['icons']) {
        const src = path.join(root, dir);
        if (fs.existsSync(src)) copyDirSync(src, path.join(distDir, dir));
      }
      const templatesSrc = path.join(root, 'assets', 'templates');
      if (fs.existsSync(templatesSrc)) {
        copyDirSync(templatesSrc, path.join(distDir, 'templates'));
      }
      for (const f of ['manifest.json', 'sw.js', 'package.json', 'CHANGELOG.md']) {
        const src = path.join(root, f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, f));
      }
    }
  };
}

module.exports = {
  root: __dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'js/main.tsx'),
      external: ['@capacitor/app'],
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          const n = (assetInfo.names && assetInfo.names[0]) || assetInfo.name || '';
          if (String(n).endsWith('.css')) return 'app.css';
          return 'assets/[name][extname]';
        },
        format: 'iife',
        name: 'CattleTrackerBundle'
      }
    }
  },
  plugins: [react(), tailwindcss(), viteDevHtmlPlugin(), viteDistCopyPlugin()]
};
