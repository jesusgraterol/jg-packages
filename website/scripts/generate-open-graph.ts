import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { PACKAGE_CATALOG, SITE_CONFIG } from '../src/site.config.ts';

/*
 * Renders the site's favicons from jg-personal-astro-ui's favicon, the jg/ mark's slash alone:
 * public/favicon.ico, at 16, 32, and 48 pixels, public/favicons/32x32.png, and
 * public/favicons/192x192.png, the home screen icon, as jesusgraterol.dev does. Then writes its
 * social image, public/og/jg-packages.png, by screenshotting open-graph-template.html in Chromium
 * with the mark and every listed package filled in. All are committed; run this after the mark,
 * the template, or the catalog changes, through `pnpm assets:generate`.
 */

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(scriptDirectory, 'open-graph-template.html');
const outputPath = resolve(scriptDirectory, '..', 'public', SITE_CONFIG.openGraph.image.slice(1));
const publicDirectory = resolve(scriptDirectory, '..', 'public');
// the sizes the ICO holds, and the PNG icons the page head links
const ICO_SIZES = [16, 32, 48] as const;
const PNG_ICON_SIZES = [32, 192] as const;
// the jg/ mark every jg site shares, and its slash alone for the favicon, from the UI package
const markSvg = await readFile(
  fileURLToPath(import.meta.resolve('jg-personal-astro-ui/jg-mark.svg')),
  'utf8',
);
const faviconSvg = await readFile(
  fileURLToPath(import.meta.resolve('jg-personal-astro-ui/jg-favicon.svg')),
  'utf8',
);
/**
 * Packs PNG images into one ICO file, each as its own entry.
 * @param images Each image's PNG data and its size in pixels.
 * @returns The ICO file.
 */
const buildIco = (images: readonly { data: Buffer; size: number }[]): Buffer => {
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);
  let imageOffset = directory.length;
  images.forEach(({ data, size }, index) => {
    const entryOffset = 6 + index * 16;
    directory.writeUInt8(size, entryOffset);
    directory.writeUInt8(size, entryOffset + 1);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(data.length, entryOffset + 8);
    directory.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += data.length;
  });
  return Buffer.concat([directory, ...images.map(({ data }) => data)]);
};

// the listed packages in catalog order, which the image lists
const PACKAGE_NAMES = Object.entries(PACKAGE_CATALOG)
  .toSorted(([, first], [, second]) => first.order - second.order)
  .map(([name]) => name);

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(resolve(publicDirectory, 'favicons'), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  // each favicon size, drawn from the SVG on a transparent page of exactly that size
  const iconPage = await browser.newPage();
  const renderIcon = async (size: number): Promise<Buffer> => {
    await iconPage.setViewportSize({ width: size, height: size });
    await iconPage.setContent(
      `<style>html, body { margin: 0; background: transparent; } svg { display: block; width: ${String(size)}px; height: ${String(size)}px; }</style>${faviconSvg}`,
    );
    return iconPage.screenshot({ omitBackground: true });
  };
  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ data: await renderIcon(size), size });
  }
  await writeFile(resolve(publicDirectory, 'favicon.ico'), buildIco(icoImages));
  for (const size of PNG_ICON_SIZES) {
    await writeFile(
      resolve(publicDirectory, 'favicons', `${String(size)}x${String(size)}.png`),
      await renderIcon(size),
    );
  }

  const page = await browser.newPage({
    viewport: { width: SITE_CONFIG.openGraph.width, height: SITE_CONFIG.openGraph.height },
  });
  await page.goto(pathToFileURL(templatePath).toString());
  await page.evaluate((markup) => {
    const mark = document.querySelector('[data-mark]');
    if (mark !== null) {
      mark.innerHTML = markup;
    }
  }, markSvg);
  await page.evaluate((names) => {
    document.querySelector('.session-list')?.replaceChildren(
      ...names.map((name) => {
        const item = document.createElement('li');
        const prefix = document.createElement('span');
        prefix.textContent = '+ ';
        item.append(prefix, name);
        return item;
      }),
    );
  }, PACKAGE_NAMES);
  await page.evaluate(async () => document.fonts.ready);
  await page.locator('.canvas').screenshot({ path: outputPath });
} finally {
  await browser.close();
}
