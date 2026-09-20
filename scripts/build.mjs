import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const width = 4095;
const height = 200;
const tabHeight = 41;
const tabOffset = { x: 32, y: 16 };
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

// Return image buffers separately from writing the package so validation can
// compare the installed assets with a fresh build of the same source artwork.
export async function renderThemeImages() {
  const header = await fs.readFile(path.join(root, 'assets/header.png'));
  const wallpaper = await fs.readFile(path.join(root, 'assets/wallpaper.jpg'));
  const headerSize = await sharp(header).metadata();
  const wallpaperSize = await sharp(wallpaper).metadata();
  assert.deepEqual([headerSize.width, headerSize.height], [3081, height], 'The header master must retain its original dimensions.');
  assert.deepEqual([wallpaperSize.width, wallpaperSize.height], [3840, 2160], 'The wallpaper master must retain its original dimensions.');

  const extend = bytes => sharp(bytes)
    .extend({ top: 0, bottom: 0, left: 0, right: width - headerSize.width, extendWith: 'copy' })
    .png().toBuffer();
  const fill = (w, h, color, opacity) => svg(w, h, `<rect width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`);

  // The frame preserves the original colors. Repeat only the last source
  // column into the unused right margin; there is no right-edge color fade.
  const frame = await extend(header);
  const tabScene = await sharp(header).modulate({ saturation: 0.90 })
    .composite([{ input: fill(headerSize.width, height, '#BEDCEC', 0.64) }])
    .png().toBuffer();
  const stops = [
    { at: 0, opacity: 0.32 },
    { at: 76, opacity: 0.32 },
    { at: 102, opacity: 0.52 },
    { at: 120, opacity: 0.56 },
    { at: 200, opacity: 0.56 },
  ];
  const toolbarWash = `<defs><linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">${stops.map(stop => `<stop offset="${stop.at / height}" stop-color="#BEDCEC" stop-opacity="${stop.opacity}"/>`).join('')}</linearGradient></defs><rect width="100%" height="100%" fill="url(#wash)"/>`;
  const toolbarScene = await sharp(header).modulate({ saturation: 1 })
    .composite([{ input: svg(headerSize.width, height, toolbarWash) }])
    .png().toBuffer();

  // Horizontal Edge tabs sample a different origin from the exposed frame.
  // Preserve the measured 32px horizontal and 16px vertical compensation.
  const alignedTabs = await sharp(await extend(tabScene))
    .extract({ left: tabOffset.x, top: tabOffset.y, width: width - tabOffset.x, height: tabHeight })
    .extend({ top: 0, bottom: 0, left: 0, right: tabOffset.x, extendWith: 'copy' })
    .png().toBuffer();
  const tintTabs = (color, opacity) => sharp(alignedTabs)
    .composite([{ input: fill(width, tabHeight, color, opacity) }])
    .png().toBuffer();
  const activeTabs = await tintTabs('#B7CCDA', 0.90);
  const backgroundTabs = await tintTabs('#BEDCEC', 0.22);

  // Active tabs reuse the first 41 toolbar rows. The visible toolbar samples
  // later rows, which retain the unshifted source and the bookmark wash.
  const toolbar = await sharp(await extend(toolbarScene))
    .composite([{ input: activeTabs, left: 0, top: 0 }]).png().toBuffer();
  const inactiveFrame = await sharp(frame)
    .composite([{ input: fill(width, height, '#FFFFFF', 0.16) }]).png().toBuffer();
  const inactiveTabs = await sharp(backgroundTabs)
    .composite([{ input: fill(width, tabHeight, '#FFFFFF', 0.16) }]).png().toBuffer();
  const ntp = await sharp(wallpaper)
    .resize(2560, 1440, { fit: 'cover', position: 'centre' }).png().toBuffer();

  return {
    'frame.png': frame,
    'frame-inactive.png': inactiveFrame,
    'toolbar.png': toolbar,
    'background-tab.png': backgroundTabs,
    'background-tab-inactive.png': inactiveTabs,
    'ntp.png': ntp,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const images = await renderThemeImages();
  const destination = path.join(root, 'theme/images');
  await fs.mkdir(destination, { recursive: true });
  for (const [name, bytes] of Object.entries(images)) {
    await fs.writeFile(path.join(destination, name), bytes);
  }
  console.log('Built six unfaded theme images; the manifest is unchanged.');
}
