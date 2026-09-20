import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { renderThemeImages } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = path.join(root, 'theme');
const exactKeys = (object, keys, label) => {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label} must be an object.`);
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), `Unexpected ${label} fields.`);
};
const imageNames = {
  theme_frame: 'images/frame.png',
  theme_frame_inactive: 'images/frame-inactive.png',
  theme_toolbar: 'images/toolbar.png',
  theme_ntp_background: 'images/ntp.png',
  theme_tab_background: 'images/background-tab.png',
  theme_tab_background_inactive: 'images/background-tab-inactive.png',
};
const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'manifest.json'), 'utf8'));

// A static theme needs only these fields. This rejects scripts, permissions,
// remote resources, extension keys, update URLs, and unrelated package data.
exactKeys(manifest, ['manifest_version', 'name', 'version', 'description', 'theme'], 'manifest');
assert.equal(manifest.manifest_version, 3);
assert(typeof manifest.version === 'string' && /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(manifest.version), 'The browser manifest requires a numeric version.');
const versionParts = manifest.version.split('.').map(Number);
assert(versionParts.every(part => part <= 65535) && versionParts.some(part => part > 0), 'Invalid numeric manifest version.');
assert.equal(manifest.name, 'Fran, Sky Blue');
assert(typeof manifest.description === 'string' && manifest.description.length > 0 && manifest.description.length <= 132);
const privateReference = /(?:[a-z]:[\\/]|\\\\|\/(?:Users|home)\/|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
for (const value of [manifest.name, manifest.description]) {
  assert(!privateReference.test(value), 'Manifest text must not contain machine paths, contacts, or URLs.');
}
exactKeys(manifest.theme, ['images', 'colors', 'tints', 'properties'], 'theme');
assert.deepEqual(manifest.theme.images, imageNames, 'Theme image paths must match the six local PNGs.');
const colorNames = [
  'frame', 'frame_inactive', 'frame_incognito', 'frame_incognito_inactive',
  'toolbar', 'tab_text', 'tab_background_text', 'tab_background_text_inactive',
  'tab_background_text_incognito', 'tab_background_text_incognito_inactive',
  'bookmark_text', 'toolbar_text', 'toolbar_button_icon', 'omnibox_background',
  'omnibox_text', 'ntp_background', 'ntp_text', 'ntp_link', 'button_background',
];
exactKeys(manifest.theme.colors, colorNames, 'theme color');
for (const [name, color] of Object.entries(manifest.theme.colors)) {
  assert(Array.isArray(color) && color.length === (name === 'button_background' ? 4 : 3), `Invalid ${name} color.`);
  assert(color.slice(0, 3).every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255), `Invalid ${name} RGB value.`);
  if (color.length === 4) assert(Number.isFinite(color[3]) && color[3] >= 0 && color[3] <= 1);
}
exactKeys(manifest.theme.tints, ['buttons', 'frame', 'frame_inactive', 'background_tab'], 'theme tint');
for (const tint of Object.values(manifest.theme.tints)) {
  assert(Array.isArray(tint) && tint.length === 3 && tint.every(value => Number.isFinite(value) && value >= -1 && value <= 1));
}
assert.deepEqual(manifest.theme.properties, {
  ntp_background_alignment: 'center top',
  ntp_background_repeat: 'no-repeat',
  ntp_logo_alternate: 1,
});

// Edge writes this cache beside the manifest when the unpacked theme is loaded.
// It is local browser state, and package.mjs never includes it in the ZIP.
const packageEntries = (await fs.readdir(packageRoot, { withFileTypes: true }))
  .filter(entry => !(entry.name === 'Cached Theme.pak' && entry.isFile()));
assert.deepEqual(packageEntries.map(entry => entry.name).sort(), ['images', 'manifest.json']);
assert(packageEntries.find(entry => entry.name === 'images').isDirectory());
assert(packageEntries.find(entry => entry.name === 'manifest.json').isFile());
const imageEntries = await fs.readdir(path.join(packageRoot, 'images'), { withFileTypes: true });
assert.deepEqual(imageEntries.map(entry => entry.name).sort(), Object.values(imageNames).map(name => path.basename(name)).sort());
assert(imageEntries.every(entry => entry.isFile()), 'Images must be regular files, without links or subdirectories.');

function validatePngChunks(bytes, name) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name}: invalid PNG signature.`);
  let offset = 8;
  const chunks = [];
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, `${name}: truncated PNG chunk.`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    assert(['IHDR', 'pHYs', 'IDAT', 'IEND'].includes(type), `${name}: unexpected PNG metadata ${type}.`);
    assert(offset + length + 12 <= bytes.length, `${name}: invalid PNG chunk length.`);
    chunks.push(type);
    if (type === 'IHDR') assert.equal(length, 13);
    if (type === 'pHYs') assert.equal(length, 9);
    if (type === 'IEND') assert.equal(length, 0);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.equal(chunks[0], 'IHDR');
  assert.equal(chunks.filter(type => type === 'IHDR').length, 1);
  assert(chunks.includes('IDAT'));
  assert.equal(chunks.at(-1), 'IEND');
  assert.equal(offset, bytes.length, `${name}: unexpected trailing data.`);
}

const expectedImages = await renderThemeImages();
for (const [name, expected] of Object.entries(expectedImages)) {
  const bytes = await fs.readFile(path.join(packageRoot, 'images', name));
  validatePngChunks(bytes, name);
  const metadata = await sharp(bytes).metadata();
  const dimensions = name === 'ntp.png' ? [2560, 1440]
    : [4095, name.startsWith('background-tab') ? 41 : 200];
  assert.equal(metadata.format, 'png');
  assert(metadata.width < 4096 && metadata.height < 4096, `${name}: store image limit exceeded.`);
  assert.deepEqual([metadata.width, metadata.height], dimensions, `${name}: unexpected image dimensions.`);
  const actualPixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
  const expectedPixels = await sharp(expected).ensureAlpha().raw().toBuffer();
  assert(actualPixels.equals(expectedPixels), `${name}: packaged pixels differ from the source recipe.`);
  for (let alpha = 3; alpha < actualPixels.length; alpha += 4) {
    assert.equal(actualPixels[alpha], 255, `${name}: unexpected transparent pixels.`);
  }
}
console.log(`Validated version ${manifest.version}: exactly seven static theme files, clean PNG metadata, images below 4096px, and source-matching pixels.`);
