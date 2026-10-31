import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { ThemeInitializationScript } from 'jg-personal-react-ui';

const storageId = 'jg-ui-gallery';

export default defineConfig({
  root:
    process.env['JG_REACT_UI_GALLERY_ROOT'] ?? fileURLToPath(new URL('./gallery', import.meta.url)),
  define: { __JG_UI_STORAGE_ID__: JSON.stringify(storageId) },
  plugins: [
    tailwindcss(),
    {
      name: 'gallery-theme-initialization',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html.replace(
            '<head>',
            '<head>' +
              renderToStaticMarkup(createElement(ThemeInitializationScript, { storageId })),
          ),
      },
    },
  ],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
