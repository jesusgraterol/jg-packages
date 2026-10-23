import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { codeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
import { externalLinkPlugin } from 'jg-personal-astro-ui/external-link-plugin';
import { SYNTAX_THEME } from 'jg-personal-astro-ui/syntax-theme';

export default defineConfig({
  site: 'https://gallery.example',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    shikiConfig: { theme: SYNTAX_THEME },
    processor: satteri({
      hastPlugins: [codeWindowPlugin, externalLinkPlugin({ siteUrl: 'https://gallery.example' })],
    }),
  },
  vite: { plugins: [tailwindcss()], preview: { strictPort: true } },
});
