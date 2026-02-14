/**
 * Vite config: ESM entry (js/main.js), single bundle dist/app.js.
 * External libs (PapaParse, Chart.js, xlsx) stay in index.html script tags.
 */
const path = require('path');
const fs = require('fs');

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
        fs.writeFileSync(path.join(distDir, 'index.html'), html);
      }
      for (const dir of ['css', 'icons']) {
        const src = path.join(root, dir);
        if (fs.existsSync(src)) copyDirSync(src, path.join(distDir, dir));
      }
      for (const f of ['manifest.json', 'sw.js']) {
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
    rollupOptions: {
      input: path.resolve(__dirname, 'js/main.tsx'),
      output: {
        entryFileNames: 'app.js',
        format: 'iife',
        name: 'CattleTrackerBundle'
      }
    }
  },
  plugins: [viteDistCopyPlugin()]
};
