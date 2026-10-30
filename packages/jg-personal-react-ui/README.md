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

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-personal-react-ui@0.1.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-personal-react-ui@0.1.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
