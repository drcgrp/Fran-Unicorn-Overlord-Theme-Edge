import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from 'fflate';

const root = new URL('../', import.meta.url);
const validation = spawnSync(process.execPath, [fileURLToPath(new URL('validate.mjs', import.meta.url))], {
  cwd: fileURLToPath(root),
  stdio: 'inherit',
});
if (validation.error) throw validation.error;
if (validation.status !== 0) process.exit(validation.status ?? 1);

const names = [
  'manifest.json',
  'images/background-tab-inactive.png',
  'images/background-tab.png',
  'images/frame-inactive.png',
  'images/frame.png',
  'images/ntp.png',
  'images/toolbar.png',
];
const inputs = {};
const files = {};
for (const name of names) {
  inputs[name] = await readFile(new URL(`theme/${name}`, root));
  files[name] = [inputs[name], { mtime: new Date(2000, 0, 1, 0, 0, 0) }];
}
const archive = zipSync(files, { level: 9 });
const unpacked = unzipSync(archive);
if (Object.keys(unpacked).length !== names.length) throw new Error('Unexpected archive entries.');
for (const name of names) {
  if (!inputs[name].equals(Buffer.from(unpacked[name] ?? []))) {
    throw new Error(`Archive verification failed: ${name}`);
  }
}
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/fran-sky-blue.zip', root), archive);
const digest = createHash('sha256').update(archive).digest('hex');
await writeFile(new URL('dist/fran-sky-blue.zip.sha256', root), `${digest}  fran-sky-blue.zip\n`);
console.log(`Packaged ${names.length} files in dist/fran-sky-blue.zip (${archive.length} bytes).`);
console.log(`SHA-256: ${digest}`);
