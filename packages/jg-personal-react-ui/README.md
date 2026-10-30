# jg-personal-react-ui

JG-branded React components backed by the shared jg-react-ui implementation.

## Install

```bash
pnpm add jg-personal-react-ui
```

## Usage

```ts
import { createElement } from 'react';
import { Button } from 'jg-personal-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

Import Tailwind once, then `jg-personal-react-ui/styles.css`.

Button, Badge, IconTile, Alert, their composition slots, variants, and public contracts are direct re-exports of `jg-react-ui`. `JgMark` is the decorative JG mark, with `className` for layout and the same fixed artwork as Astro. Import it from the root or `jg-personal-react-ui/components/jg-mark`; pair it with visible text when identifying a brand link.

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-personal-react-ui@0.2.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-personal-react-ui@0.2.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
