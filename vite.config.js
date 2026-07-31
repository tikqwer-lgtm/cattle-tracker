/**
 * Vite config: ESM entry (js/main.js), single bundle dist/app.js + dist/app.css.
 * External libs (PapaParse, Chart.js, xlsx) stay in index.html script tags.
 */
const path = require('path');
const fs = require('fs');
const tailwindcss = require('@tailwindcss/vite').default;

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

function viteDistCopyPlugin() {
  const root = path.resolve(__dirname);
  return {
    name: 'vite-dist-copy',
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
        fs.writeFileSync(path.join(distDir, 'index.html'), html);
      }
      for (const dir of ['icons']) {
        const src = path.join(root, dir);
        if (fs.existsSync(src)) copyDirSync(src, path.join(distDir, dir));
      }
      for (const f of ['manifest.json', 'sw.js', 'package.json']) {
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
  plugins: [tailwindcss(), viteDistCopyPlugin()]
};
