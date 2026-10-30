# jg-react-ui

Consumer-themed React components with retained Moldea-derived APIs.

## Install

```bash
pnpm add jg-react-ui
```

## Usage

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

Import Tailwind once, then `jg-react-ui/styles.css`. Supply `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--chart-1` (success), `--chart-2` (warning), `--border`, `--radius`, `--jg-ui-font-sans`, and `--jg-ui-font-mono` in your own theme. Colors must be complete CSS color values. `.dark` selects dark utility variants; this package supplies no brand palette. For the JG palette and fonts, use `jg-personal-react-ui` instead.

Button, Badge, IconTile, and Alert retain Moldea’s APIs from commit `2920a7b0a6e814e95872fcdd6dd8746ae422c038`, including variants, sizes, refs, badges, and `asChild` where supported. The exported `badgeVariants`, `iconTileVariants`, and `alertVariants` retain their source signatures. Badge defaults to a span; IconTile is decorative unless `aria-hidden={false}` is supplied; static Alert uses `role="alert"`, with phrasing-content title and description slots. Button’s touch sizes preserve at least 44px under a coarse pointer, including on tablets. Button’s `asChild` requires exactly one element and retains Base UI’s button semantics, including when that element is an anchor. Use the child’s explicit `role="link"` when it represents navigation.

All JavaScript entries are safe to import during server rendering. Styles remain explicit CSS imports. UI preference schemas retain the complete theme, diff layout, wrapping, and install-dismissal record; the dismissal timestamp is an ISO datetime string or `null`. This release exports contracts without starting a preference store or theme provider.

Badge and Alert `asChild` also require exactly one element, otherwise they throw `Error("asChild requires exactly one valid React element child.")`. For `interaction="redirect"`, slot an anchor; for `interaction="action"`, slot a native button. The interaction option supplies styling, while the native child supplies keyboard semantics. Keep supplementary `AlertAction` controls inside a static Alert, away from interactive parent buttons or anchors. A linked Badge remains compact by default; add coarse-pointer minimum dimensions when it is a standalone touch target.

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-react-ui@0.2.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-react-ui@0.2.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
