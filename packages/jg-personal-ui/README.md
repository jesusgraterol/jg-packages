# jg-personal-ui

JG visual foundations shared by personal React and Astro interfaces.

## Install

```bash
pnpm add jg-personal-ui
```

## Usage

```ts
import { JG_PERSONAL_UI_TOKEN_NAMES } from 'jg-personal-ui';
const sharedTokens = JG_PERSONAL_UI_TOKEN_NAMES;
```

Import Tailwind once, then `jg-personal-ui/styles/theme.css` and `jg-personal-ui/styles/contract.css`.

The `brand` entry exports fixed JG mark and favicon geometry. Import `jg-personal-ui/jg-mark.svg` or `jg-personal-ui/jg-favicon.svg` as standalone assets. Their colors stay fixed in both themes. `pnpm --filter jg-personal-ui brand:generate` regenerates the committed SVGs; builds run `brand:check` and reject stale output.

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-personal-ui@0.2.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-personal-ui@0.2.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
