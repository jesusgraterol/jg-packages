import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { PACKAGE_CATALOG, SITE_CONFIG } from '../src/site.config.ts';

/*
 * Writes the site's favicon, public/favicon.svg, as a copy of jg-personal-astro-ui's jg/ mark, and
 * its social image, public/og/jg-packages.png, by screenshotting open-graph-template.html in
 * Chromium with the mark and every listed package filled in. Both are committed; run this after
 * the mark, the template, or the catalog changes, through `pnpm assets:generate`.
 */

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(scriptDirectory, 'open-graph-template.html');
const outputPath = resolve(scriptDirectory, '..', 'public', SITE_CONFIG.openGraph.image.slice(1));
const faviconPath = resolve(scriptDirectory, '..', 'public', 'favicon.svg');
// the jg/ mark every jg site shares, from the UI package
const markSvg = await readFile(
  fileURLToPath(import.meta.resolve('jg-personal-astro-ui/jg-mark.svg')),
  'utf8',
);
// the listed packages in catalog order, which the image lists
const PACKAGE_NAMES = Object.entries(PACKAGE_CATALOG)
  .toSorted(([, first], [, second]) => first.order - second.order)
  .map(([name]) => name);

await writeFile(faviconPath, markSvg);
await mkdir(dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
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
