# Recipes

## Verify an Astro build before shipping it

```ts
import { verifyStaticSite } from 'jg-site-checks';

const origin = 'https://example.com';
const result = await verifyStaticSite({
  artifactRoot: 'dist',
  origin,
  pages: [
    { path: '/', canonicalUrl: `${origin}/`, indexable: true },
    { path: '/404.html', canonicalUrl: null, indexable: false },
  ],
  discovery: {
    sitemap: '/sitemap-index.xml',
    robots: '/robots.txt',
    llms: '/llms.txt',
  },
});

console.log(`Verified ${result.pages.length} pages.`);
```

Use your route inventory to populate `pages`. A non-indexable page should carry a `noindex` robots directive. Use `result.sitemapEntries` for checks that depend on the published page records.
