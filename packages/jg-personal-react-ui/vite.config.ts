import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root:
    process.env['JG_REACT_UI_GALLERY_ROOT'] ?? fileURLToPath(new URL('./gallery', import.meta.url)),
  plugins: [tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
