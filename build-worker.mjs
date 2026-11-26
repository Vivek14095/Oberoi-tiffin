import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const paths = ['index.html', 'app.js', 'style.css', ...((await readdir('dist/assets')).map(name => 'assets/' + name))];
const assets = Object.fromEntries(await Promise.all(paths.map(async path => [
  '/' + path, (await readFile('dist/' + path)).toString('base64'),
])));
await mkdir('dist/server', {recursive: true});
await writeFile('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + await readFile('worker.mjs', 'utf8'));
