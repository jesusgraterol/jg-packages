// the offline guide's responsive, system-theme stylesheet
export const GUIDE_STYLES = `
:root { color-scheme: light dark; font-family: system-ui, sans-serif; background: Canvas; color: CanvasText; --surface: color-mix(in srgb, CanvasText 4%, Canvas); --line: color-mix(in srgb, CanvasText 18%, Canvas); --muted: color-mix(in srgb, CanvasText 72%, Canvas); --action: oklch(15.434% 0.00002 271.152); --action-text: oklch(99.048% 0.00493 166.268); }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { scroll-padding-block-start: calc(var(--guide-nav-height, 0px) + 1rem); }
body { margin: 0; padding: 0 max(1rem, env(safe-area-inset-right)) max(2rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
main { max-width: 48rem; margin-inline: auto; }
.page-header { padding-block: max(1.5rem, env(safe-area-inset-top)) 1rem; }
.page-header > p:first-child { margin: 0; font-size: .8125rem; font-weight: 600; color: var(--muted); }
h1 { max-width: 32ch; font-size: clamp(1.5rem, 4vw, 2rem); letter-spacing: -.025em; line-height: 1.2; margin-block: .5rem .75rem; }
h1, h2, h3, p, a, summary, label, figcaption, li { overflow-wrap: anywhere; }
p, li { line-height: 1.6; }
p { max-width: 65ch; }
.guide-intro { margin-block: 0; font-size: .9375rem; color: var(--muted); }
h2 { font-size: 1.25rem; margin-block: 0 0.5rem; }
h3 { display: flex; align-items: center; gap: .75rem; font-size: 1.125rem; line-height: 1.4; margin-block: 0 1rem; scroll-margin-block-start: .75rem; }
.step-number { display: inline-flex; flex: 0 0 1.75rem; height: 1.75rem; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 50%; font-size: .8125rem; font-weight: 600; color: var(--muted); }
a { color: CanvasText; text-underline-offset: .2em; }
a:focus-visible, summary:focus-visible, textarea:focus-visible, button:focus-visible, h3:focus-visible { outline: 3px solid CanvasText; outline-offset: 3px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.toolbar { position: static; top: 0; z-index: 2; background: Canvas; padding-block: max(.5rem, env(safe-area-inset-top)) .5rem; margin-block-end: 1rem; border-block-end: 1px solid var(--line); }
.network-nav, .step-nav { display: flex; gap: .125rem; }
html[data-guide-controls] .toolbar { position: sticky; }
.network-nav { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; padding: .25rem; border-radius: .875rem; background: var(--surface); }
.network-nav a, .step-nav a { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: .5rem .125rem; text-align: center; font-size: .8125rem; line-height: 1.3; }
.network-nav a { flex: 1 0 auto; min-width: 44px; padding-inline: .25rem; max-width: 100%; white-space: normal; color: var(--muted); text-decoration: none; border-radius: .625rem; font-weight: 600; }
.network-nav a[aria-current="location"] { background: var(--action); color: var(--action-text); }
.step-nav { margin-block-start: .125rem; }
.step-nav a { color: var(--muted); text-decoration: none; }
.step-nav a:active { background: var(--surface); }
summary { cursor: pointer; min-height: 48px; padding-block: .75rem; }
.channel { padding-block: 0; }
.channel > summary { font-size: 1.125rem; }
.network-heading { display: inline-flex; align-items: center; vertical-align: middle; gap: .75rem; padding-inline-start: .5rem; margin: 0; font-size: 1.125rem; }
.format { flex-shrink: 0; white-space: nowrap; font-size: .8125rem; font-weight: 400; padding: .25rem .625rem; border-radius: 2rem; background: var(--surface); color: var(--muted); }
.channel-content { padding-block: 1rem; }
.steps { list-style: none; padding: 0; margin: 0; }
.steps > li + li { margin-block-start: 2.5rem; }
.copy-block { margin-block-start: 1rem; }
.copy-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-block-end: .75rem; }
.copy-label { min-width: 0; }
label { display: block; font-size: .875rem; font-weight: 600; }
button { min-width: 72px; min-height: 44px; flex-shrink: 0; border: 1px solid var(--action); border-radius: .625rem; padding: .5rem 1rem; background: var(--action); color: var(--action-text); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer; }
button[aria-disabled="true"] { cursor: progress; opacity: .75; }
button:active { filter: brightness(.9); }
textarea { display: block; width: 100%; min-width: 0; border: 1px solid GrayText; border-radius: .75rem; padding: 1rem; resize: vertical; background: var(--surface); color: CanvasText; font: inherit; font-size: 1rem; line-height: 1.65; }
.copy-status { min-height: 1.5em; margin-block: .125rem 0; color: var(--muted); font-size: .8125rem; line-height: 1.5; }
.file-link, footer a, .selected-files a { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding-block: .5rem; }
.file-link { font-size: .875rem; }
.selected-files { display: flex; flex-wrap: wrap; gap: .5rem 1rem; }
.uploads { list-style: none; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; margin-block: 1.5rem; }
.uploads li { min-width: 0; }
figure { margin: 0; border: 1px solid var(--line); border-radius: .875rem; padding: .875rem; }
.media-file { display: flex; align-items: center; gap: 1rem; color: CanvasText; text-decoration: none; }
.media-file img { flex: 0 0 5rem; width: 5rem; height: 6.25rem; object-fit: contain; margin: 0; border-radius: .25rem; }
.file-info { display: grid; gap: .25rem; min-width: 0; font-size: .875rem; line-height: 1.4; }
.file-meta { font-size: .75rem; color: var(--muted); }
.file-action { margin-block-start: .25rem; color: CanvasText; text-decoration: underline; text-underline-offset: .2em; }
.image-description { margin-block-start: .75rem; border-block-start: 1px solid var(--line); padding-block-start: .25rem; }
.image-description > summary { font-size: .875rem; }
.image-description p { margin-block: .5rem; font-size: .875rem; }
.checks { padding-inline-start: 1.25rem; }
.checks li + li { margin-block-start: .5rem; }
.next-link { display: flex; justify-content: center; width: 100%; min-height: 48px; margin-block-start: 1.5rem; border: 1px solid var(--action); border-radius: .75rem; padding: .75rem 1rem; background: var(--action); color: var(--action-text); font-size: 1rem; font-weight: 600; text-decoration: none; }
.next-link:active { filter: brightness(.9); }
.appendix { margin-block-start: 1.5rem; border-block-start: 1px solid var(--line); padding-block-start: .5rem; }
.appendix > summary { font-size: .875rem; color: var(--muted); }
.inventory { padding-inline-start: 1.25rem; }
.inventory li + li { margin-block-start: 1rem; }
.files { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: 2rem; }
.files article { min-width: 0; margin-block: 2rem; }
.files video { display: block; width: 100%; height: auto; max-height: 27rem; background: #0c0c0c; color-scheme: dark; }
.files img { display: block; width: 100%; height: auto; max-height: 27rem; object-fit: contain; margin-block: .75rem .5rem; }
footer { margin-block-start: 1.5rem; color: var(--muted); font-size: .8125rem; }
@media (min-width: 42rem) { .uploads { grid-template-columns: repeat(2, minmax(0, 1fr)); } .network-nav a, .step-nav a { font-size: .875rem; } .channel-content { padding-inline: .5rem; } }
@media (prefers-color-scheme: dark) { :root { --action: oklch(97.024% 0.00684 124.958); --action-text: oklch(22% 0.025 257.693); } }
@media (forced-colors: active) { button, .next-link, .network-nav a[aria-current="location"] { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; } }
`;
