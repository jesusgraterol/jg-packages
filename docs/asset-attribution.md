# Asset attribution

Where the marks, fonts, and icons the website and `jg-personal-astro-ui` use come from, and the terms they're used under.

## jg/ mark

`jg-personal-astro-ui`'s `jg-mark.svg` is the lowercase `jg/` mark every jg site shares. Its letters are the outlines of `j`, `g`, and `/` in Ubuntu Sans Mono at weight 700, extracted once from Fontsource's `@fontsource-variable/ubuntu-sans-mono` files and drawn as paths, so they render the same everywhere without the font. Three letters drawn as paths are a document made with the font, not a version of it, which the [Ubuntu Font Licence 1.0](https://ubuntu.com/legal/font-licence) leaves unrestricted. `jg-mark.astro` draws the same paths inline, and `jg-favicon.svg` draws the slash alone, 1.55 times as large, on the same tile, because the three letters can't be read at a favicon's 16 pixels. Don't alter its letterforms, its colors, or the accent slash.

The website's `public/favicon.svg` is written from `jg-favicon.svg`, and `public/og/jg-packages.png`, the open-graph image, draws it beside text set in Ubuntu Sans. `pnpm --filter @jg-packages/website assets:generate` regenerates both.

## Fonts

`jg-personal-astro-ui` depends on [Ubuntu Sans and Ubuntu Sans Mono](https://design.ubuntu.com/font), Copyright 2011, 2022, 2023 Canonical Ltd., through Fontsource's `@fontsource-variable/ubuntu-sans` and `@fontsource-variable/ubuntu-sans-mono`. `theme.css` imports them, so sites bundle the font files from those packages unchanged.

Both are under the [Ubuntu Font Licence 1.0](https://ubuntu.com/legal/font-licence), which each Fontsource package ships as its `LICENSE`. It allows bundling and embedding the fonts. It grants no trademark rights, and a modified font must be renamed, so don't edit the font files.

## Icons

The interface icons and each package's icon are [Lucide](https://lucide.dev/) icons, drawn as inline SVG through `@lucide/astro`, under the [ISC License](https://lucide.dev/license). [`website.md`](website.md#package-icons) lists the package icons. No package uses a technology's mark.
