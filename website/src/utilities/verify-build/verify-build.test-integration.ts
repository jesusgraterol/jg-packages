import { strict as assert } from 'node:assert';
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { PACKAGE_CATALOG } from '../../site.config.ts';
import { verifyBuild } from './verify-build.ts';

/*
 * verifyBuild against the site's real build, which `build` writes before these tests run, and
 * against copies of it, each broken in one way that one check must catch.
 */

const BUILD_DIRECTORY = resolve(import.meta.dirname, '..', '..', '..', 'dist');
const PACKAGE_PAGE = 'packages/jg-fetch/index.html';
const RECIPES_PAGE = 'packages/jg-fetch/recipes/index.html';
const STRUCTURED_DATA = /<script type="application\/ld\+json">[^<]+<\/script>/u;

// breaks one copy of the build
type IBuildMutation = (buildDirectory: string) => Promise<void>;

let temporaryRoot = '';
let fixtureCount = 0;

/**
 * Resolves a path inside a copy of the build, refusing one that leaves it.
 * @param buildDirectory The copy.
 * @param path The path, relative to it.
 * @returns The absolute path.
 */
const resolveInBuild = (buildDirectory: string, path: string): string => {
  const absolute = resolve(buildDirectory, path);
  assert.ok(!relative(buildDirectory, absolute).startsWith(`..${sep}`));
  return absolute;
};

/**
 * Replaces text in a file of a copy of the build, failing when the text isn't there.
 * @param buildDirectory The copy.
 * @param path The file.
 * @param search The text or pattern to replace.
 * @param replacement What replaces it.
 */
const replaceText = async (
  buildDirectory: string,
  path: string,
  search: string | RegExp,
  replacement: string,
): Promise<void> => {
  const file = resolveInBuild(buildDirectory, path);
  const text = await readFile(file, 'utf8');
  const replaced = text.replace(search, replacement);
  assert.notEqual(replaced, text);
  await writeFile(file, replaced);
};

/**
 * Copies the real build into a new directory under the suite's temporary root.
 * @returns The copy.
 */
const copyBuild = async (): Promise<string> => {
  fixtureCount += 1;
  const directory = join(temporaryRoot, `build-${String(fixtureCount).padStart(2, '0')}`);
  await cp(BUILD_DIRECTORY, directory, { recursive: true, errorOnExist: true });
  return directory;
};

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'jg-packages-verify-build-'));
});

afterAll(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('verifyBuild', () => {
  test('passes the real build', async () => {
    await expect(verifyBuild(BUILD_DIRECTORY)).resolves.toBeUndefined();
  });

  test.each<[string, string, IBuildMutation]>([
    [
      'a missing llms.txt',
      'Missing build path: llms.txt',
      (build) => rm(resolveInBuild(build, 'llms.txt')),
    ],
    [
      'a missing open-graph image',
      'Missing build path: og/jg-packages.png',
      (build) => rm(resolveInBuild(build, 'og/jg-packages.png')),
    ],
    [
      'a test file',
      'Production build contains a test file: leaked.test-unit.js',
      (build) => writeFile(resolveInBuild(build, 'leaked.test-unit.js'), '// a test\n'),
    ],
    [
      'a missing recipes page',
      'Missing package page: packages/jg-fetch/recipes/index.html',
      (build) => rm(resolveInBuild(build, RECIPES_PAGE)),
    ],
    [
      "a missing package page's Markdown version",
      'Missing package page: packages/jg-fetch/index.md',
      (build) => rm(resolveInBuild(build, 'packages/jg-fetch/index.md')),
    ],
    [
      'an event handler',
      'Page holds an event handler or a URL with a disallowed scheme in index.html: onload attribute',
      (build) => replaceText(build, 'index.html', '<body', '<body onload="alert(1)"'),
    ],
    [
      'a script URL',
      `Page holds an event handler or a URL with a disallowed scheme in ${RECIPES_PAGE}: href="javascript:alert(1)"`,
      (build) =>
        replaceText(build, RECIPES_PAGE, '</main>', '<a href="javascript:alert(1)">x</a></main>'),
    ],
    [
      'a repeated element ID',
      `Page repeats an element ID in ${PACKAGE_PAGE}: api-reference`,
      (build) =>
        replaceText(build, PACKAGE_PAGE, '</body>', '<span id="api-reference"></span></body>'),
    ],
    [
      'missing metadata',
      'Missing required metadata in index.html: <meta property="og:type" content="website"',
      (build) =>
        replaceText(build, 'index.html', /<meta property="og:type" content="website">/u, ''),
    ],
    [
      'a missing Markdown alternate',
      `Missing required metadata in ${RECIPES_PAGE}: <link rel="alternate" type="text\\/markdown"`,
      (build) => replaceText(build, RECIPES_PAGE, /<link rel="alternate"[^>]*>/u, ''),
    ],
    [
      'a missing Markdown version',
      'Page has no Markdown version: index.html -> index.md',
      (build) => rm(resolveInBuild(build, 'index.md')),
    ],
    [
      'a repeated title',
      'Missing or duplicate page title in packages/jg-fs/index.html',
      async (build) => {
        const title = /<title>[^<]+<\/title>/u.exec(
          await readFile(resolveInBuild(build, 'packages/jg-exception/index.html'), 'utf8'),
        )?.[0];
        assert.ok(title);
        await replaceText(build, 'packages/jg-fs/index.html', /<title>[^<]+<\/title>/u, title);
      },
    ],
    [
      'a repeated description',
      'Missing or duplicate page description in packages/jg-fs/index.html',
      async (build) => {
        const description = /<meta name="description" content="[^"]+"/u.exec(
          await readFile(resolveInBuild(build, 'packages/jg-exception/index.html'), 'utf8'),
        )?.[0];
        assert.ok(description);
        await replaceText(
          build,
          'packages/jg-fs/index.html',
          /<meta name="description" content="[^"]+"/u,
          description,
        );
      },
    ],
    [
      'a title over 60 characters',
      `Page title is longer than 60 characters in ${PACKAGE_PAGE}`,
      (build) =>
        replaceText(
          build,
          PACKAGE_PAGE,
          /<title>[^<]+<\/title>/u,
          `<title>${'x'.repeat(61)}</title>`,
        ),
    ],
    [
      'a description under 70 characters',
      `Page description is not 70 to 160 characters long in ${RECIPES_PAGE}`,
      (build) =>
        replaceText(
          build,
          RECIPES_PAGE,
          /<meta name="description" content="[^"]+"/u,
          '<meta name="description" content="Too short."',
        ),
    ],
    [
      'a page missing from the sitemap',
      'Canonical URL is missing from the sitemap: https://jg-packages.jesusgraterol.dev/packages/jg-fetch/recipes/',
      (build) =>
        replaceText(
          build,
          'sitemap-0.xml',
          '<loc>https://jg-packages.jesusgraterol.dev/packages/jg-fetch/recipes/</loc>',
          '',
        ),
    ],
    [
      'missing structured data',
      'Missing structured data in index.html',
      (build) => replaceText(build, 'index.html', STRUCTURED_DATA, ''),
    ],
    [
      'invalid structured data',
      `Invalid structured data in ${PACKAGE_PAGE}`,
      (build) =>
        replaceText(
          build,
          PACKAGE_PAGE,
          STRUCTURED_DATA,
          '<script type="application/ld+json">{invalid</script>',
        ),
    ],
    [
      'structured data that is no object',
      `Structured data is not an object in ${PACKAGE_PAGE}`,
      (build) =>
        replaceText(
          build,
          PACKAGE_PAGE,
          STRUCTURED_DATA,
          '<script type="application/ld+json">[1]</script>',
        ),
    ],
    [
      'an invalid structured data graph',
      `Structured data graph is invalid in ${PACKAGE_PAGE}`,
      (build) =>
        replaceText(
          build,
          PACKAGE_PAGE,
          STRUCTURED_DATA,
          '<script type="application/ld+json">{"@graph":[null]}</script>',
        ),
    ],
    [
      'structured data for another page',
      `Structured data does not match the canonical page in ${RECIPES_PAGE}`,
      (build) =>
        replaceText(
          build,
          RECIPES_PAGE,
          '"url":"https://jg-packages.jesusgraterol.dev/packages/jg-fetch/recipes/"',
          '"url":"https://jg-packages.jesusgraterol.dev/"',
        ),
    ],
    [
      'a home page list without a package',
      'Home page item list does not list every package',
      (build) =>
        replaceText(
          build,
          'index.html',
          /\{"@type":"ListItem","name":"jg-fs","position":\d+,"url":"[^"]+"\},?/u,
          '',
        ),
    ],
    [
      'a breadcrumb that ends elsewhere',
      `Breadcrumb hierarchy is incomplete in ${RECIPES_PAGE}`,
      (build) =>
        replaceText(
          build,
          RECIPES_PAGE,
          '"item":"https://jg-packages.jesusgraterol.dev/packages/jg-fetch/recipes/"',
          '"item":"https://jg-packages.jesusgraterol.dev/packages/jg-fetch/"',
        ),
    ],
    [
      'a package page without its source code',
      `Package page is missing its source code entity in ${PACKAGE_PAGE}`,
      (build) =>
        replaceText(build, PACKAGE_PAGE, '"@type":"SoftwareSourceCode"', '"@type":"CreativeWork"'),
    ],
    [
      'a broken internal link',
      `Broken internal link in ${RECIPES_PAGE}: /packages/jg-missing/ -> packages/jg-missing/index.html`,
      (build) =>
        replaceText(build, RECIPES_PAGE, '</main>', '<a href="/packages/jg-missing/">x</a></main>'),
    ],
    [
      'a fragment without its target',
      'Fragment link has no matching element ID in index.html: /#nowhere -> index.html',
      (build) => replaceText(build, 'index.html', '</main>', '<a href="/#nowhere">x</a></main>'),
    ],
    [
      'an indexable 404 page',
      'The 404 page must stay out of search indexes',
      (build) =>
        replaceText(
          build,
          '404.html',
          '<meta name="robots" content="noindex, follow">',
          '<meta name="robots" content="index, follow">',
        ),
    ],
    [
      'a canonical URL on the 404 page',
      'The 404 page must not name a canonical URL',
      (build) =>
        replaceText(
          build,
          '404.html',
          '</head>',
          '<link rel="canonical" href="https://jg-packages.jesusgraterol.dev/404.html"></head>',
        ),
    ],
    [
      'a 404 page description under 70 characters',
      'Page description is not 70 to 160 characters long in 404.html',
      (build) =>
        replaceText(
          build,
          '404.html',
          /<meta name="description" content="[^"]+"/u,
          '<meta name="description" content="Not found."',
        ),
    ],
    [
      'robots.txt without the sitemap',
      'robots.txt does not name the sitemap index',
      (build) => replaceText(build, 'robots.txt', /^Sitemap: .*$/mu, ''),
    ],
    [
      'llms.txt without the setup links',
      'llms.txt does not follow the required structure',
      (build) => replaceText(build, 'llms.txt', /^## Agent setup$/mu, '## Setup'),
    ],
    [
      'a broken llms.txt link',
      'Broken internal llms.txt link: https://jg-packages.jesusgraterol.dev/missing/index.md -> missing/index.md',
      (build) =>
        replaceText(
          build,
          'llms.txt',
          '## Recipes\n',
          '## Recipes\n\n- [Missing](https://jg-packages.jesusgraterol.dev/missing/index.md): x\n',
        ),
    ],
    [
      'llms-full.txt without a package',
      'llms-full.txt is missing a package or its recipes: jg-sw',
      (build) => replaceText(build, 'llms-full.txt', '\n# jg-sw recipes\n', '\n# recipes\n'),
    ],
    [
      'an old package name',
      `The build names a package the site never mentions in ${PACKAGE_PAGE}: error-message-utils`,
      (build) =>
        replaceText(build, PACKAGE_PAGE, '</main>', '<p>Use error-message-utils.</p></main>'),
    ],
    [
      'the UI package',
      'The build names a package the site never mentions in llms-full.txt: jg-personal-astro-ui',
      (build) =>
        appendFile(resolveInBuild(build, 'llms-full.txt'), '\nBuilt with jg-personal-astro-ui.\n'),
    ],
  ])('rejects a build with %s', async (_, message, mutation) => {
    const build = await copyBuild();
    await mutation(build);

    await expect(verifyBuild(build)).rejects.toThrow(message);
  });

  test('rejects a build without the pages of a newly listed package', async () => {
    const build = await copyBuild();

    await expect(verifyBuild(build, [...Object.keys(PACKAGE_CATALOG), 'jg-new'])).rejects.toThrow(
      'Missing package page: packages/jg-new/index.html',
    );
  });
});
