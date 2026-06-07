/**
 * Splits a monolithic JS file into submodules under a folder.
 * Replaces top-level state vars with SM.state.* via window.__namespace.
 *
 * Usage: node scripts/refactor-split-file.js <config-json-path>
 */
const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];
if (!configPath) {
  console.error('Usage: node refactor-split-file.js <config.json>');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const root = path.join(__dirname, '..');
const srcPath = path.join(root, config.source);
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');

const stateVars = config.stateVars || [];
const chunks = config.chunks;
const ns = config.namespace;
const facadePath = path.join(root, config.facade || config.source);
const folder = path.join(root, config.folder);

fs.mkdirSync(folder, { recursive: true });

// Build state mapping
const stateInit = {};
stateVars.forEach((v) => {
  stateInit[v.name] = v.initial;
});

// Extract state var declarations from source for shared.js
let sharedContent = `/** Shared state for ${ns} */\n`;
sharedContent += `if (typeof window !== 'undefined') {\n`;
sharedContent += `  window.${ns} = window.${ns} || {};\n`;
sharedContent += `  if (!window.${ns}.state) {\n`;
sharedContent += `    window.${ns}.state = ${JSON.stringify(stateInit, null, 2).replace(/"([^"]+)":/g, '$1:')};\n`;
sharedContent += `  }\n`;
sharedContent += `}\n`;
sharedContent += `export {};\n`;

// Fix JSON initial values - need proper JS
const stateLines = ['/** Shared state for ' + ns + ' */', 'if (typeof window !== \'undefined\') {',
  '  window.' + ns + ' = window.' + ns + ' || {};',
  '  if (!window.' + ns + '.state) {',
  '    window.' + ns + '.state = {'];
stateVars.forEach((v) => {
  stateLines.push('      ' + v.name + ': ' + v.initial + ',');
});
stateLines.push('    };');
stateLines.push('  }');
stateLines.push('}');
stateLines.push('export {};');
fs.writeFileSync(path.join(folder, 'shared.js'), stateLines.join('\n') + '\n');

function transformChunk(chunkLines, chunkName) {
  let out = `/** ${chunkName} */\n`;
  out += `var SM = typeof window !== 'undefined' ? (window.${ns} = window.${ns} || {}, window.${ns}) : { state: {} };\n\n`;

  chunkLines.forEach((line) => {
    let l = line;
    stateVars.forEach((v) => {
      const re = new RegExp('\\b' + v.jsName + '\\b', 'g');
      l = l.replace(re, 'SM.state.' + v.name);
    });
    out += l + '\n';
  });

  // Attach functions to namespace for cross-chunk access
  const fnMatches = [...out.matchAll(/^function (\w+)/gm)];
  if (fnMatches.length) {
    out += '\nif (typeof window !== \'undefined\') {\n';
    fnMatches.forEach((m) => {
      out += `  window.${ns}.${m[1]} = ${m[1]};\n`;
    });
    out += '}\n';
  }

  out += 'export {};\n';
  return out;
}

// Map old var names to state keys
stateVars.forEach((v) => {
  v.jsName = v.jsName || ('_' + ns.replace('__', '').replace(/__/g, '') + v.name);
});

// Re-read - fix state var names from config
stateVars.forEach((v) => {
  if (!v.jsName) {
    // auto-detect from source first line matching
  }
});

chunks.forEach((chunk) => {
  const chunkLines = lines.slice(chunk.start - 1, chunk.end);
  const content = transformChunk(chunkLines, chunk.name);
  fs.writeFileSync(path.join(folder, chunk.file), content);
  console.log('  wrote', chunk.file, `(${chunkLines.length} lines)`);
});

// Facade
let facade = `/** Facade: ${path.basename(config.source)} */\n`;
facade += `import './shared.js';\n`;
chunks.forEach((chunk) => {
  facade += `import './${chunk.file}';\n`;
});
if (config.windowExports) {
  facade += '\nif (typeof window !== \'undefined\') {\n';
  config.windowExports.forEach((exp) => {
    facade += `  window.${exp} = window.${ns}.${exp};\n`;
  });
  facade += '}\n';
}
facade += 'export {};\n';
fs.writeFileSync(facadePath, facade);

// Backup original
const bak = srcPath + '.bak';
if (!fs.existsSync(bak)) {
  fs.copyFileSync(srcPath, bak);
}

console.log('Facade:', facadePath);
console.log('Done. Original backed up to', bak);
