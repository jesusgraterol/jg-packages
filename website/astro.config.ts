import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { SYNTAX_THEME } from 'jg-personal-astro-ui/syntax-theme';

import { SITE_CONFIG } from './src/site.config.ts';

export default defineConfig({
  site: SITE_CONFIG.url,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    // the READMEs' code blocks use the same --jg-syntax-* colours as the components'
    shikiConfig: { theme: SYNTAX_THEME },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
