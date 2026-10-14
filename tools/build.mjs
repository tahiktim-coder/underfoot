// node tools/build.mjs [out.html] [--dev] [--tpl=page/looks.html] [--entry=src/main.js]
// Bundles src/main.js with esbuild (one IIFE, no runtime dependencies) and puts it in the template at __SCRIPT__.
import esbuild from 'esbuild';
import fs from 'fs';
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist/index.html';
const minify = !process.argv.includes('--dev');
const tpl = process.argv.find((a) => a.startsWith('--tpl='))?.slice(6) || 'page/looks.html';
const entry = process.argv.find((a) => a.startsWith('--entry='))?.slice(8) || 'src/main.js';
const r = await esbuild.build({ entryPoints: [entry], bundle: true, format: 'iife', minify, write: false, target: ['es2020'], legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(tpl, 'utf8').replace('__SCRIPT__', () => js);
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(1) + ' KB');
