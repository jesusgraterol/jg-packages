# jg-personal-ui recipes

App-side composition with the public surface.

## Use the public entry

```ts
import { JG_PERSONAL_UI_TOKEN_NAMES } from 'jg-personal-ui';
const sharedTokens = JG_PERSONAL_UI_TOKEN_NAMES;
```

## Select syntax token names

```ts
import { JG_PERSONAL_UI_TOKEN_NAMES } from 'jg-personal-ui/tokens';
const syntaxTokens = JG_PERSONAL_UI_TOKEN_NAMES.filter((name) => name.startsWith('--jg-syntax-'));
```

## Render fixed brand artwork

For inline rendering, use the canonical canvas, tile, and outlined paths without changing their colors.

```ts
import { JG_MARK_VIEW_BOX, JG_MARK_TILE, JG_MARK_PATHS } from 'jg-personal-ui/brand';
const artwork = { viewBox: JG_MARK_VIEW_BOX, tile: JG_MARK_TILE, paths: JG_MARK_PATHS };
```

Bundlers with SVG URL support can import `jg-personal-ui/jg-mark.svg` and `jg-personal-ui/jg-favicon.svg` as assets. Use the bundler’s SVG module types in TypeScript. The React adapter provides inline rendering through JgMark.
