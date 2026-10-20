# jg-site

Structured data, llms.txt files, and theme preferences for websites, as small functions that run in browsers and Node.js.

## Install

```bash
npm install jg-site
```

## Usage

Describe a page to search engines with JSON-LD, and serialize it for a `<script type="application/ld+json">`. Every `<` is escaped, so text in the data can't close the script element:

```ts
import { buildStructuredData, serializeStructuredData } from 'jg-site';

const json = serializeStructuredData(
  buildStructuredData({
    breadcrumbs: [
      { name: 'Docs', path: '/' },
      { name: 'Install', path: '/install/' },
    ],
    canonicalUrl: 'https://docs.example.com/install/',
    description: 'Install the CLI with npm, pnpm, or Yarn, and check that it runs.',
    site: {
      author: { name: 'Ada Lovelace', url: 'https://ada.example.com/' },
      language: 'en',
      name: 'Example Docs',
      url: 'https://docs.example.com',
    },
    title: 'Install | Example Docs',
    type: 'webpage',
  }),
);
```

A page that builds the rest of its structured data itself can add just the breadcrumb. A step without a URL, such as the current page, has no `item`:

```ts
import { buildBreadcrumbStructuredData } from 'jg-site';

buildBreadcrumbStructuredData([
  { name: 'Home', url: 'https://example.com/' },
  { name: 'Blog', url: 'https://example.com/blog' },
  { name: 'Release notes' },
]);
```

Write an llms.txt in the [llmstxt.org](https://llmstxt.org/) format, and an llms-full.txt from the site's Markdown documents:

```ts
import { buildLlmsFullText, buildLlmsText } from 'jg-site';

const llmsText = buildLlmsText({
  name: 'Example Docs',
  summary: 'Guides and the API reference for the Example CLI.',
  sections: [
    {
      heading: 'Guides',
      links: [
        { title: 'Install', url: 'https://docs.example.com/install.md', description: 'Set it up.' },
        { title: 'Changelog', url: 'https://docs.example.com/changelog.md' },
      ],
    },
  ],
});
const llmsFullText = buildLlmsFullText({
  name: 'Example Docs',
  summary: 'Guides and the API reference for the Example CLI.',
  documents: ['# Install\n\nRun `npm install example-cli`.\n'],
});
```

Read and store a visitor's theme preference. Stored values are untrusted, so anything unknown reads as `'system'`, and a browser that blocks storage never throws:

```ts
import { readThemePreference, resolveThemePreference, writeThemePreference } from 'jg-site';

const preference = readThemePreference('example-theme'); // 'system', 'light', or 'dark'
const theme = resolveThemePreference(
  preference,
  matchMedia('(prefers-color-scheme: dark)').matches,
); // 'light' or 'dark'
writeThemePreference('example-theme', 'dark'); // false when the browser blocks storage
```

`SEARCH_TEXT_LIMITS` holds the lengths that keep titles and descriptions whole in search results, for build checks.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-site/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-site/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-site/LICENSE)
