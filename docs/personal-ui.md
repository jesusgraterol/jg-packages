# Personal UI packages

These packages support JG apps and are deliberately excluded from the public website catalog. The private gallery is a development tool and never ships in npm tarballs.

| Package                | Ownership                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `jg-personal-ui`       | Shared JG palette, Ubuntu Sans fonts, radius, semantic tokens, and token-name exports. No React or Astro dependency. |
| `jg-react-ui`          | Consumer-themed React implementations, initially Button, `cn`, and shared UI preference contracts.                   |
| `jg-personal-react-ui` | Direct re-exports of the generic components plus JG styling and the optional system-theme fallback.                  |
| `jg-personal-astro-ui` | Existing Astro components. Its current styles remain independent until the planned foundation migration.             |

The React implementation originates at Moldea commit `2920a7b0a6e814e95872fcdd6dd8746ae422c038`. Button retains its variants, sizes, badges, native props, refs, and `asChild` API. Touch sizes preserve 44px targets under a coarse pointer, including at tablet widths. JG styling maps the generic token contract to the shared palette, including a visible dark-theme link color. Moldea and HQ are unchanged.

## Styles

A React application imports Tailwind once, then `jg-personal-react-ui/styles.css`. Optionally import `jg-personal-react-ui/system-theme-fallback.css` afterward to apply dark utility variants before a theme provider runs. Explicit `.light` and `.dark` classes take precedence over the system preference. No theme provider or persistence side effect runs on import.

Consumers of the generic package supply the CSS custom properties described in its README, then import `jg-react-ui/styles.css`. The generic package supplies no brand palette. Stylesheets are explicit exports and marked as side effects so bundlers retain them.

## Private React gallery

```bash
pnpm turbo run build --filter=jg-personal-react-ui
pnpm --filter jg-personal-react-ui gallery:dev
pnpm --filter jg-personal-react-ui test:e2e
```

The gallery uses published package exports. `?theme=light` and `?theme=dark` exercise explicit preferences; an absent preference follows the OS. The Playwright suite checks 320px, tablet, and desktop layouts in both schemes, keyboard activation and visible focus, disabled controls, reduced motion, axe, and coarse pointer target sizes. Its preview process owns and stops its Vite child.

Release verification copies this gallery into a temporary consumer and installs the exact UI and sibling tarballs. It builds with Vite and Tailwind, checks component and React identity, and runs the same Chromium, Firefox, and WebKit scenarios. It reuses the release fixture's bounded command lifecycle and teardown. Fonts are resolved from the foundation's runtime dependencies. Gallery code and tests are excluded from the packages' production builds and tarballs.

Until Astro adopts the foundation, the foundation's token test checks that its declarations still match Astro's source values. Page geometry, component composition, and inverse-section behavior remain owned by Astro.
