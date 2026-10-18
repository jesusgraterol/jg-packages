import type { APIRoute } from 'astro';

import { SITE_CONFIG } from '../site.config.ts';
import { toTextResponse } from '../utilities/site-markdown/index.ts';

// every crawler may read the whole site, and the sitemap index lists its pages
export const GET: APIRoute = () =>
  toTextResponse(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', SITE_CONFIG.url).toString()}\n`,
    'text/plain',
  );
