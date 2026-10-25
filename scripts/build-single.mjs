// Packs the whole app into ONE self-contained HTML file:
//   dist/naapurina-datakeskus.html  – full page; works offline by double-clicking it (fonts fall back to system fonts offline)
//   dist/artifact.html              – the same content without <html>/<head>/<body> wrappers, for publishing as a claude.ai artifact
// Usage (from the app folder):  node scripts/build-single.mjs
// Needs esbuild: uses $ND_ESBUILD if set, otherwise downloads it once with npx (esbuild@0.25.0).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const esbuildArgs = ['src/main.js', '--bundle', '--format=iife', '--minify', '--target=es2020', '--charset=utf8', '--legal-comments=none'];
const bundle = process.env.ND_ESBUILD
  ? execFileSync(process.env.ND_ESBUILD, esbuildArgs, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  : execFileSync('npx', ['--yes', 'esbuild@0.25.0', ...esbuildArgs], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32' });

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssFiles = [...index.matchAll(/<link rel="stylesheet" href="(src\/styles\/[^"]+)">/g)].map((m) => m[1]);
const css = cssFiles.map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const safeJs = bundle.replace(/<\/script/gi, '<\\/script');
const safeCss = css.replace(/<\/style/gi, '<\\/style');

const full = index
  .replace(/\s*<link rel="stylesheet" href="src\/styles\/[^"]+">/g, '')
  .replace('</head>', () => `<style>\n${safeCss}\n</style>\n</head>`)
  .replace(/<script type="module" src="src\/main\.js"><\/script>/, () => `<script>\n${safeJs}\n</script>`);
fs.writeFileSync(path.join(dist, 'naapurina-datakeskus.html'), full);

// Artifact variant: the publisher wraps the content in its own document skeleton.
const headInner = full.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const bodyInner = full.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync(path.join(dist, 'artifact.html'), `${headInner.trim()}\n${bodyInner.trim()}\n`);

const kb = (f) => Math.round(fs.statSync(path.join(dist, f)).size / 1024);
console.log(`dist/naapurina-datakeskus.html ${kb('naapurina-datakeskus.html')} KB, dist/artifact.html ${kb('artifact.html')} KB`);
