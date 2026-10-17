# Asset attribution

Where the marks, fonts, and icons the website and `jg-personal-astro-ui` use come from, and the terms they're used under.

## JG mark

`website/public/favicon.svg` is an unchanged copy of the `JG/` monogram from jesusgraterol.dev's `public/favicon.svg`, which JG Skills uses too. `website/src/components/brand-mark/brand-mark.astro` redraws the same monogram with the theme's terminal tokens, so it's a dark tile in both themes. Don't alter its letterforms or the accent slash.

## Fonts

`jg-personal-astro-ui` depends on [Ubuntu Sans and Ubuntu Sans Mono](https://design.ubuntu.com/font), Copyright 2011, 2022, 2023 Canonical Ltd., through Fontsource's `@fontsource-variable/ubuntu-sans` and `@fontsource-variable/ubuntu-sans-mono`. `theme.css` imports them, so sites bundle the font files from those packages unchanged.

Both are under the [Ubuntu Font Licence 1.0](https://ubuntu.com/legal/font-licence), which each Fontsource package ships as its `LICENSE`. It allows bundling and embedding the fonts. It grants no trademark rights, and a modified font must be renamed, so don't edit the font files.

## Icons

The interface icons and each package's icon are [Lucide](https://lucide.dev/) icons, drawn as inline SVG through `@lucide/astro`, under the [ISC License](https://lucide.dev/license). [`website.md`](website.md#package-icons) lists the package icons. No package uses a technology's mark.
