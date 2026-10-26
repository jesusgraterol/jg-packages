import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { createCodeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
import { SYNTAX_THEME } from 'jg-personal-astro-ui/syntax-theme';

import { SITE_CONFIG } from './src/site.config.ts';

export default defineConfig({
  site: SITE_CONFIG.url,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    // the READMEs' code blocks use the same --jg-syntax-* colours as the components', in the same
    // code windows
    shikiConfig: { theme: SYNTAX_THEME },
    processor: satteri({ hastPlugins: [createCodeWindowPlugin({ copyDisplay: 'icon' })] }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
