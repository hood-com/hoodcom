import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const walk = async (dir) => (await readdir(dir, { withFileTypes: true })).flatMap((entry) => entry.isDirectory() ? [] : [join(dir, entry.name)]);
const dirs = ['', 'components', 'config', 'pages', 'services', 'stores', 'utils', 'netlify/functions'];
const files = (await Promise.all(dirs.map((dir) => walk(join(root, dir))))).flat().filter((file) => /\.m?js$/u.test(file));
let failures = 0;
for (const file of files) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status) { console.error(syntax.stderr); failures++; }
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/gu)) {
    try { await access(resolve(dirname(file), match[2])); }
    catch { console.error(`Missing import: ${file} -> ${match[2]}`); failures++; }
  }
}
if (failures) { console.error(`Checks failed: ${failures}`); process.exit(1); }
console.log(`Checks passed for ${files.length} JavaScript modules; syntax and local imports are valid.`);
