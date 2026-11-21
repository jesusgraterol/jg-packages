# Recipes

## Render a transparent PNG

```ts
import { chromium } from 'playwright';

import { withOfflineRenderer } from 'jg-render';

const browser = await chromium.launch();
try {
  const png = await withOfflineRenderer(browser, {}, (renderer) =>
    renderer.renderPng({
      html: '<!doctype html><svg width="64" height="64"><circle cx="32" cy="32" r="16" /></svg>',
      width: 80,
      height: 80,
      transparent: true,
    }),
  );
  console.log(png.byteLength);
} finally {
  await browser.close();
}
```

Render multiple images inside one callback to reuse its context. Use a local `@font-face` with a data URL for any text, and list the expected families and weights in `requiredFonts`.
