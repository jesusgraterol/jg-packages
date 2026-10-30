# Personal UI packages

These packages support JG apps and are deliberately excluded from the public website catalog. The private gallery is a development tool and never ships in npm tarballs.

| Package                | Ownership                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jg-personal-ui`       | Shared JG palette, Ubuntu Sans fonts, radius, semantic tokens, token-name exports, and canonical mark/favicon artwork. No React or Astro dependency.                 |
| `jg-react-ui`          | Consumer-themed React implementations, Button, Badge, IconTile, Alert, preference/theme providers, scoped error feedback, notifications, `cn`, and shared contracts. |
| `jg-personal-react-ui` | Direct re-exports of the generic components plus JG styling, the decorative JgMark, and the optional system-theme fallback.                                          |
| `jg-personal-astro-ui` | Existing Astro components. Its current styles remain independent until the planned foundation migration.                                                             |

The React implementation originates at Moldea commit `2920a7b0a6e814e95872fcdd6dd8746ae422c038`. Button retains its variants, sizes, badges, native props, refs, and `asChild` API. Touch sizes preserve 44px targets under a coarse pointer, including at tablet widths. Badge, IconTile, Alert and its title/description/action slots retain the pinned public props, variants, defaults, and slot behavior. The internal slotted-render hook uses named React imports for ESM compatibility, and unnecessary prop casts are removed to satisfy this repository’s TypeScript lint rules. JG styling maps the generic token contract to the shared palette, including a visible dark-theme link color. Moldea and HQ are unchanged.

## Styles

A React application imports Tailwind once, then `jg-personal-react-ui/styles.css`. Optionally import `jg-personal-react-ui/system-theme-fallback.css` afterward to apply dark utility variants before a theme provider runs. Explicit `.light` and `.dark` classes take precedence over the system preference. No theme provider or persistence side effect runs on import.

Consumers of the generic package supply the CSS custom properties described in its README, then import `jg-react-ui/styles.css`. The generic package supplies no brand palette. Stylesheets are explicit exports and marked as side effects so bundlers retain them.

Preference normalization preserves valid fields individually, including an explicit `null` dismissal timestamp when overriding a previously dismissed install prompt. This corrects the source helper’s null-as-default merge behavior while retaining the nullable preference contract. In-memory stores are created per provider; equivalent snapshots retain identity and do not notify subscribers.

## Preferences and document theme

Preference stores are provider-local. The optional captured `storageId` uses jg-storage’s ASCII letter/digit/underscore/hyphen rules and defaults to `jg-ui-preferences`; `getUiPreferencesStorageKey` owns the raw key contract. A keyed remount switches namespaces. Local providers follow matching storage events, read-only providers deny changes, and remote providers serialize/coalesce optimistic updates and roll back rejected batches to current authoritative props. Applications own remote adapters and cache updates. Unmounted providers have no late persistence or feedback effects.

Render `ThemeInitializationScript` in the document head with the provider’s matching namespace and optional CSP nonce. Initial render snapshots use props/defaults without browser I/O, then synchronize storage after hydration. ThemeProvider applies the document root class, and ThemeToggleButton uses the source capability/pending behavior. Use one document theme owner and one Toastr host; their effects are document-wide even with multiple isolated preference roots. Toastr preserves source icons, slots, props, stacking, and notification APIs, with JG roles supplied by the personal adapter, coarse-pointer targets, reduced motion, and a hydration-safe body portal.

The pinned preference/theme/toastr source paths were re-inspected before this port and had no live drift. Adaptations retain the source APIs while replacing the global store and private error registry, keeping current resolver/adapter refs after commits, preserving cancellation privacy, validating namespaces, and correcting explicit-null normalization. Theme root effects rely on React’s browser effect lifecycle; server rendering performs no root mutation. Toastr uses the configured font role. JG stylesheet overrides keep default-button and toast-action hover text readable against the retained translucent dark surfaces.

## Application error feedback

`ErrorFeedbackProvider` and `useErrorFeedbackResolver` share one scoped policy across generic and personal imports. Applications supply `jg-exception`'s `createErrorFeedback` result with their authored code messages and access-loss classification. Unconfigured trees use generic copy without raw diagnostic text or unknown codes. Cancellation is preserved, and a resolver that throws falls back to the generic policy. No mutable global application policy is installed.

## Private React gallery

```bash
pnpm turbo run build --filter=jg-personal-react-ui
pnpm --filter jg-personal-react-ui gallery:dev
pnpm --filter jg-personal-react-ui test:e2e
```

The gallery uses published package exports, including the head initialization script, persisted settings, theme controls, and real notifications. `?theme=light` and `?theme=dark` exercise explicit preferences; an absent preference follows the OS. The Playwright suite checks 320px, tablet, and desktop layouts in both schemes, keyboard activation and visible focus, disabled controls, reduced motion, axe, and coarse pointer target sizes. Its preview process owns and stops its Vite child.

Release verification copies this gallery into a temporary consumer and installs the exact UI and sibling tarballs. It builds with Vite and Tailwind, checks component and React identity, and runs the same Chromium, Firefox, and WebKit scenarios. It reuses the release fixture's bounded command lifecycle and teardown. Fonts are resolved from the foundation's runtime dependencies. Gallery code and tests are excluded from the packages' production builds and tarballs.

The foundation owns `src/brand/constants.ts` and generated standalone `src/assets/jg-mark.svg` and `jg-favicon.svg`. `JgMark` renders those constants directly. `brand:generate` updates the raw SVGs atomically; `brand:check` runs during builds and rejects drift. Tests compare generated output with the unchanged Astro artwork until migration. The generator is development-only and its filesystem dependency never enters runtime artifacts.

Until Astro adopts the foundation, the foundation's token test checks that its declarations still match Astro's source values. Page geometry, component composition, and inverse-section behavior remain owned by Astro.
