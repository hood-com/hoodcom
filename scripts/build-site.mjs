import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, '_site');
const rootExtensions = new Set(['.html', '.js', '.css', '.svg', '.ico', '.png', '.jpg', '.jpeg', '.webp']);
const publicDirectories = ['components', 'config', 'pages', 'services', 'stores', 'utils'];
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const directory of publicDirectories) await cp(join(root, directory), join(output, directory), { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const extension = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase() : '';
  if (rootExtensions.has(extension)) await cp(join(root, entry.name), join(output, entry.name));
}
console.log(`Production site built in ${output}; server functions and private setup files are excluded.`);
