# jg-personal-astro-ui

The Astro components, Tailwind CSS token contract, and theme that Jesus Graterol's sites share, published as `jg-personal-astro-ui`. Four sites are built from it: this repository's [website](website.md), [jesusgraterol.dev](https://jesusgraterol.dev), [Agentic Coding](https://agenticcoding.jesusgraterol.dev), and [jg-skills](https://jg-skills.jesusgraterol.dev). It stays unlisted on the site, and its API can change in any `0.x` release.

## Setting up a site

Install it with its peers, and Astro's Markdown processor, at the version your `astro` depends on, for the code windows in Markdown:

```bash
npm install jg-personal-astro-ui astro tailwindcss @tailwindcss/vite @astrojs/markdown-satteri
```

Add the Tailwind CSS Vite plugin, the package's syntax theme for Markdown code, and `codeWindowPlugin`, which puts every Markdown code block in a code window, in `astro.config.ts`:

```ts
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { codeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
import { SYNTAX_THEME } from 'jg-personal-astro-ui/syntax-theme';

export default defineConfig({
  markdown: {
    shikiConfig: { theme: SYNTAX_THEME },
    processor: satteri({ hastPlugins: [codeWindowPlugin] }),
  },
  vite: { plugins: [tailwindcss()] },
});
```

`codeWindowPlugin` is a hast plugin for Sätteri, the processor Astro uses by default, not a rehype plugin: Astro runs rehype plugins only on its older `unified` processor.

To open the Markdown's links to other sites in a new tab, as the components do, add `externalLinkPlugin({ siteUrl })` from `jg-personal-astro-ui/external-link-plugin` after it, with the site's URL. It gives every absolute `http` or `https` link to another origin `target="_blank"`, `rel="noreferrer"`, and the new-tab marker. A link that already has a target keeps it, and links written as HTML in the Markdown stay as written.

Import the stylesheets in the site's global stylesheet, in this order:

```css
@import 'tailwindcss';
@import 'jg-personal-astro-ui/styles/contract.css';
@import 'jg-personal-astro-ui/styles/theme.css';
@import 'jg-personal-astro-ui/styles/prose.css';
```

Then render `DocumentHead` and `ThemeInitScript` in every page's `<head>`, so the theme applies before the first paint, and render Markdown inside `prose`, which loads what makes the code windows' copy buttons work. `website/src/layouts/base-layout.astro` is a complete layout.

## The token contract

`contract.css` maps `--jg-*` custom properties to Tailwind CSS theme values, so components use utilities such as `bg-surface` and `text-muted`. It also defines the `dark` variant, which follows the `.dark` class the theme script sets on `<html>`, and the shared classes `eyebrow`, `display-title`, `section-title`, `lede`, `jg-container`, `jg-container-prose`, `jg-section-space`, `jg-hero-backdrop`, `jg-code`, and the code window's `jg-code-window`, `jg-code-window-header`, `jg-code-window-dots`, and `jg-code-window-caption`.

`theme.css` gives every property its value, in a light palette on `:root` and a dark one on `.dark`, with the system preference deciding until the theme script runs. Code windows stay dark in both themes, so it also gives `.jg-code-window` the dark palette's `--jg-syntax-*` values. Inverse sections receive a local dark palette through `.jg-section-inverse`. A custom theme supplies every property, its code-window syntax colors, and the inverse section's local palette, following these public surface scopes.

| Properties                                                          | Tailwind CSS utilities                                  | What they're for                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `--jg-background`, `--jg-foreground`                                | `bg-background`, `text-foreground`                      | The page and its text                                                 |
| `--jg-surface`, `--jg-secondary`                                    | `bg-surface`, `bg-secondary`                            | Cards and panels, and hover and muted fills                           |
| `--jg-muted`                                                        | `text-muted`                                            | Secondary text                                                        |
| `--jg-border`, `--jg-border-strong`                                 | `border-border`, `border-border-strong`                 | Hairlines, and borders that need contrast                             |
| `--jg-primary`, `--jg-primary-foreground`                           | `bg-primary`, `text-primary-foreground`                 | Primary buttons and icon tiles; near-black in light, inverted in dark |
| `--jg-accent`, `--jg-accent-foreground`                             | `text-accent`, `bg-accent`                              | The teal accent                                                       |
| `--jg-terminal`, `--jg-terminal-foreground`, `--jg-terminal-accent` | `bg-terminal`, …                                        | Terminal panels, dark in both themes                                  |
| `--jg-inverse`, `--jg-inverse-foreground`, `--jg-inverse-accent`    | `bg-inverse`, `text-inverse-foreground`, …              | Panels that stay dark in both themes, such as a contact band          |
| `--jg-focus`                                                        | `outline-focus`                                         | Focus rings                                                           |
| `--jg-code`                                                         | `bg-code`                                               | Code blocks and inline code                                           |
| `--jg-success`, `--jg-warning`, `--jg-danger`                       | `bg-success`, `text-warning`, …                         | Statuses                                                              |
| `--jg-diff-added`, `--jg-diff-removed`                              | `bg-diff-added`, `bg-diff-removed`                      | Diff lines                                                            |
| `--jg-font-sans`, `--jg-font-mono`                                  | `font-sans`, `font-mono`                                | Ubuntu Sans and Ubuntu Sans Mono                                      |
| `--jg-radius`                                                       | `rounded-sm` to `rounded-2xl`                           | The base radius the others scale from                                 |
| `--jg-page-width`, `--jg-prose-width`, `--jg-page-gutter`           | `max-w-page`, `px-page`, and the `jg-container` classes | The page column, the reading column, and the side gutter              |
| `--jg-section-space`                                                | `py-section`                                            | The space between home page sections                                  |
| `--jg-shadow-surface`, `--jg-shadow-raised`                         | `shadow-surface`, `shadow-raised`                       | Resting cards, and floating panels                                    |
| `--jg-syntax-*`                                                     | none                                                    | Code colours, read by the syntax theme                                |

## Components

Each component is its own subpath, such as `jg-personal-astro-ui/button`. Most take a `class` prop for layout classes on their root element; the page frame (`skip-link`, `site-header`, and `site-footer`) and the head components don't.

| Component              | What it renders                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accordion`            | Native details and summary with rich summary, icon, status, and body slots; exclusive groups and progressive deep-link opening                                                                                                                                                                                                               |
| Documentation          | `documentation-shell`, `documentation-outline`, and `page-navigation`: a responsive reading frame, hierarchical fragments, and adjacent pages with caller-owned content and routes                                                                                                                                                           |
| File presentation      | `file-preview` and `file-tree`: caller-supplied paths and statuses, source/diff composition, actions, and bounded semantic file lists                                                                                                                                                                                                        |
| Conversations          | `conversation` and `conversation-message`: ordered transcripts with caller-owned participants, roles, avatars, content, and artifacts                                                                                                                                                                                                        |
| Process and results    | `steps`, `step`, `timeline`, `timeline-item`, and `result-summary`: supplied process, chronological, and outcome presentation                                                                                                                                                                                                                |
| `document-head`        | The title, description, canonical URL, robots, Open Graph and X tags, JSON-LD, icons, and agent links; `openGraphType` with its `article:*` or `profile:*` tags, and an `alternate` version of the page                                                                                                                                      |
| `new-tab-marker`       | The arrow and screen-reader notice that end a link opening a new tab, with `data-new-tab-marker` on the arrow                                                                                                                                                                                                                                |
| `theme-init-script`    | The inline script that applies the stored or system theme before the first paint                                                                                                                                                                                                                                                             |
| `skip-link`            | A "Skip to main content" link that shows on focus                                                                                                                                                                                                                                                                                            |
| `site-header`          | The sticky header: brand, navigation, search at every width, actions, and a menu on narrow screens; items take `external` and `match: 'prefix'`, and `trackSections` marks the item of the section the reader is in                                                                                                                          |
| `site-footer`          | The footer: brand, about text, link columns, and notes, in one row on wide screens however many columns                                                                                                                                                                                                                                      |
| `theme-control`        | The light and dark switch, which stores the choice                                                                                                                                                                                                                                                                                           |
| `brand-logo`           | The site's name beside the mark the site supplies, with an optional `tagline` on a second line                                                                                                                                                                                                                                               |
| `jg-mark`              | The lowercase `jg/` mark, in fixed colors, decorative; `./jg-mark.svg` is the same mark as a file, for a site's social images, and `./jg-favicon.svg` is its slash alone, for the favicon                                                                                                                                                    |
| `agentic-coding-mark`  | The Agentic Coding mark, two code chevrons meeting at a node, in fixed colors, decorative; `./agentic-coding-mark.svg` is the same mark as a file, for agenticcoding's favicon and social images                                                                                                                                             |
| `container`, `section` | The page and reading columns, and a home page section with its eyebrow, title, and lede: stacked, centered with `align="center"`, or split into the eyebrow beside the title and lede with `layout="split"`, plus a `header-end` slot after the lede                                                                                         |
| `stack`                | Its children in one column, evenly spaced, as a div, a list, or a section                                                                                                                                                                                                                                                                    |
| `page-header`          | An inner page's header over the hero backdrop: a breadcrumb, a mark in its `leading` slot, an eyebrow, the title, a lede, and actions; `align="center"` centers it, its breadcrumb included                                                                                                                                                  |
| `hero-backdrop`        | The jg sites' hero backdrop: a faint dot lattice under a soft accent glow                                                                                                                                                                                                                                                                    |
| `navigation-progress`  | The page-loading bar along the top of the viewport, shown when the next page is slow to arrive                                                                                                                                                                                                                                               |
| `breadcrumb`           | A trail of links, ending at the current page, at the start of its column or centered with `align`                                                                                                                                                                                                                                            |
| `icon-tile`            | A primary square holding an icon, sized `card` or `header`, which sizes the icon in its slot and inverts in dark mode                                                                                                                                                                                                                        |
| `button`, `text-link`  | Pill buttons and links, with variants and sizes, and an arrow and the new-tab notice on external links; `button` has an `inverse` variant for the inverse surface and takes link attributes such as `download`, and `text-link` passes other attributes on                                                                                   |
| `badge`                | A small label, with status variants, with a `neutral` variant, a status `dot`, and `mono={false}` for the page font; passes other attributes on                                                                                                                                                                                              |
| `link-card`            | A card whose whole area is one link, with icon, meta, and footer slots; `external` opens another site with an arrow in the corner, a `kicker` slot sits above the title, and other attributes pass on                                                                                                                                        |
| `card`                 | A raised surface for one item, as a div, an article, a section, or a list item; passes other attributes on                                                                                                                                                                                                                                   |
| `prose`                | Rendered Markdown in the shared reading style; passes other attributes on                                                                                                                                                                                                                                                                    |
| `inline-code`          | Code in a sentence that wraps only after `/`, `_`, `.`, and `-`, so a long path or name breaks at its separators                                                                                                                                                                                                                             |
| `kbd`                  | A key, such as `/` or `K`; a shortcut is several                                                                                                                                                                                                                                                                                             |
| `table`                | A data table with an optional caption, which scrolls sideways on its own when it's wider than the page; `scrollLabel` makes it a labelled region keyboard users can focus, `captionHidden` hides the caption from sight, and `stickyFirstColumn` pins each row's first cell                                                                  |
| `callout`              | A boxed aside, as a note, a tip, a warning, or a danger, with an optional title; `role="note"` marks one as a note in ARIA's sense                                                                                                                                                                                                           |
| `code-block`           | A code window: highlighted code on the dark terminal surface, with window dots, a caption, and copying                                                                                                                                                                                                                                       |
| `code-diff`            | Two versions of code as a diff: unified on narrow screens, side by side on wide ones                                                                                                                                                                                                                                                         |
| `terminal-window`      | The code window's frame around a shell session or output, with a copy button for an element when given its id; `wrapTitle` lets a long title wrap                                                                                                                                                                                            |
| `install-command`      | One shell command after a `$` prompt, in a terminal window under a title that wraps, with a copy button that copies the command alone, named by `context`, as in "Copy install command"                                                                                                                                                      |
| `copy-button`          | A button that copies text, an element, or the text at a `url`, such as a page's Markdown version, with `jg-clipboard`, and says what to do when the browser refuses, for each reason, linking to the `url`'s text; its box stays the same while its label changes to "Copied" or "Copy failed", and it comes in `sm` and `md` sizes          |
| `tabs`                 | ARIA tabs, with arrow keys, Home and End, and an optional remembered choice                                                                                                                                                                                                                                                                  |
| `segmented-control`    | A radio group drawn as a segmented pill, with a legend that `legendHidden` hides from sight; it works without JavaScript, and each radio's `data-segment="<value>"` lets the section around it toggle its own content with `group-has-[[data-segment=<value>]:checked]/<group>:` variants. Values are lowercase letters, digits, and hyphens |
| `dialog`               | A modal dialog, titled by its heading, with a close button: any element with `data-dialog-open` set to its id opens it, Escape, the close button, and a click outside close it, and focus returns to what opened it                                                                                                                          |
| `search-dialog`        | A search button and its dialog, which `/` and Ctrl+K or Cmd+K open too, and one Escape closes. Typing searches the site with [Pagefind](https://pagefind.app/), loaded from `pagefindPath`, and lists up to 8 results                                                                                                                        |
| `package-manager-tabs` | An install command for npm and pnpm in a terminal panel, with the choice remembered across the site                                                                                                                                                                                                                                          |

Only `theme-control`, the copy buttons, `tabs`, `accordion`, `dialog`, `search-dialog`, the header's menu, and `navigation-progress` run JavaScript in the browser, besides the theme script. Accordion enhances fragment links by opening collapsed ancestors of their target; native disclosure controls remain usable without JavaScript. Dialogs, like copy buttons, share one click listener on the document; `search-dialog` delegates shortcuts, input, retry clicks, and native dialog lifecycle events. Copy buttons come from `copy-button`, `code-block`, `terminal-window`, `install-command`, and the code windows in Markdown, which `prose` makes work; one click listener on the document serves them all, however many there are.

Code window headers and copy buttons carry `data-pagefind-ignore`, so a site's Pagefind excerpts show its content rather than "Copy" or a language name.

CopyButton accepts `display="label" | "icon"` (default `label`). CodeBlock, TerminalWindow, InstallCommand, PackageManagerTabs, and `renderCodeWindowHeader` expose the same choice as `copyDisplay`. Icon mode retains the accessible label and context, success/error announcements, and stable dimensions; its touch target expands under a coarse pointer. Existing `text`, `sourceId`, `url`, label, context, size, and tone behavior remains available. Fetched text goes directly to `jg-clipboard` as a promise so the clipboard write starts during the user gesture.

Copy controls start invisible and inert, preserving their reserved layout space while keeping inactive actions out of keyboard and assistive navigation. One document-owned handler reveals current controls, observes inserted subtrees, and survives Astro page swaps. Removal and page dismissal release feedback timers and invalidate late completions. Failure guidance stays until the next attempt and is positioned within the visual viewport; URL failures retain a link to the source.

For icon-only Markdown controls, import `createCodeWindowPlugin` from `jg-personal-astro-ui/code-window-plugin` and pass `createCodeWindowPlugin({ copyDisplay: 'icon' })` in Sätteri's `hastPlugins`. `codeWindowPlugin` remains the default label configuration, and `createCodeWindowPlugin()` produces the same output. Render transformed Markdown inside `prose` to install the shared copy behavior.

CodeBlock keeps `code`, `lang`, `title`, `copy`, `copyDisplay`, and `class`. Its `appearance="window" | "plain"` defaults to the existing always-dark window; `plain` removes window chrome and inherits the surrounding syntax palette. A plain block keeps its optional title and copy action, and composes within another frame, including inside Prose. `overflow="scroll" | "wrap"` defaults to scrolling. CSS-length `height` and `maxHeight` apply to the source body, leaving the caption and copy control outside it. The source remains keyboard-focusable; `ariaLabel` gives it a named region. Copying uses the original `code`, preserving line endings and final newlines rather than reconstructing highlighted text.

`renderCodeWindowHeader` also accepts a literal `copySource: { context, text }`, alongside its existing `{ context, sourceId }` form. Literal attributes preserve carriage returns through HTML parsing. This is source transport for copying, not an additional highlighter or source cache; all code blocks retain the shared build-time Shiki instance.

CodeDiff retains its `before` and `after` source/title objects, `lang`, and `class`. `view="auto" | "unified" | "split"` defaults to the existing container-responsive view: unified below 48rem, split above it. Other defaults remain no line numbers, full context, no word emphasis, a framed `appearance="window"`, and `overflow="scroll"`. `appearance="plain"` removes the frame and inherits its surrounding palette. Changed rows composite their tint over the code background, keeping syntax readable on page and card surfaces. `overflow="wrap"` wraps long source and gives paired split cells a shared row height. The default scrolling split view retains separate keyboard-focusable source panes.

`lineNumbers` shows original source numbers in each view. `contextLines` retains that many unchanged lines next to each changed block; every omitted interval has its exact count. With no changes, an explicit context limit represents the whole unchanged file with an omission notice. A negative, fractional, non-finite, or unsafe-integer limit retains full context. Empty files create no invented source rows. Line endings participate in comparison, and unterminated displayed lines include a final-newline notice.

The installed diff library compares exact source-line records with `maxEditLength: 1024`. Exhausting that search shows the complete original and resulting files as a replacement, with a visible explanation. Optional `highlightWords` compares paired lines only when each has at most 4096 UTF-16 code units, using the same edit-effort bound; longer or exhausted word comparisons keep line emphasis. Source parsing, model construction, and rendering remain linear outside the bounded edit searches; highlighting and output size still grow with source size. No client diff engine or additional source cache is used, and both views share the existing build-time Shiki highlighting.

PageHeader and Prose accept `titleVariant="page" | "document"` (default `page`) and optional `titleFont="sans" | "mono"`. With no font option, headings retain their inherited font. PageHeader's page scale preserves its existing title presentation. Document mode uses a compact title scale and, in Prose, a tighter heading hierarchy and rhythm; paragraph and source fonts stay independent. A nested Prose font choice stays within that scope. PageHeader's named `metadata` slot follows the optional lede and precedes the existing default actions slot; `leading` remains beside the title.

`contract.css` provides `jg-page-title` and `jg-document-title` alongside the unchanged `display-title` and `section-title` utilities. `data-jg-title-font="sans"` or `"mono"` on either new title utility selects its font. These utilities and Prose's heading styles share the scoped title font without changing body text or syntax fonts.

Section's `tone="default" | "inverse"` defaults to the current inherited surface. Inverse sections retain the theme's fixed dark inverse background in either scheme, with a locally scoped dark palette for foreground, muted text, borders, links, controls, semantic states, syntax, selection, and focus. Nested components use their normal token-based variants; explicit success, warning, and danger styles retain their meaning. The dark danger tone is adjusted for readable badge labels on nested cards, including the system-preference fallback. The section's scope ends with its subtree.

IconTile accepts `size="compact" | "card" | "header"` and `tone="primary" | "neutral" | "accent" | "success" | "warning" | "danger"`, retaining `card` and `primary` defaults. Compact tiles fit dense rows, size their slotted SVG, and remain decorative; nearby content supplies their name. All tones use the surrounding palette, including inverse sections.

External links show an arrow after their text. On a `button`, `externalIcon={false}` hides it, and so does `externalIcon: false` on a `site-footer` link; the jg-packages site does that on the links to its own repository.

### Process and outcome presentation

`steps` and `timeline` require an accessible `label` and accept `class`. Their direct children are Step and TimelineItem components, respectively, or native list items. Both retain labelled ordered-list semantics and responsive vertical connectors. Callers supply order and bounded content, including loading or pagination outside the list when records grow.

`step` requires `title` and accepts optional `number` (a supplied string or number), `status`, and `class`. Numbers display without padding or renumbering. The `title` slot replaces the title's visible fallback, `content` replaces ordinary body children, and `action` accepts one or more existing controls. Empty optional content renders no placeholder. A current step receives `aria-current="step"`.

`timeline-item` requires displayed `date` and `label`, with optional `dateTime`, `status`, and `class`. A supplied HTML-compatible `dateTime` produces a time element; without it the date remains ordinary display text. The `label`, `content` (ordinary children as fallback), and `action` slots accept rich caller content. A current item receives `aria-current="true"`. No dates are parsed, formatted, sorted, or inferred.

Both item components use `IProcessStatus` from `jg-personal-astro-ui/contracts`: `pending | current | complete | error`. Supplied statuses have visible text labels and semantic badges. They describe presentation, with transitions and domain meaning owned by the caller.

`result-summary` requires `title` and accepts `description`, `tone`, `headingLevel`, and `class`. `IResultSummaryTone`, from the same contracts entry, is `neutral | success | warning | danger`, default `neutral`. The summary reuses Card, IconTile, and Badge, with a semantic icon and a visible Summary/Success/Warning/Danger label. The `icon` and `status` slots replace those defaults; custom status content should retain a meaningful text label. `action` accepts existing controls. `headingLevel` is 1 through 6, default 3; choose the level fitting the surrounding document. The component adds no workflow execution, finding codes, or scoring.

The gallery's source/result recipe composes Tabs, FilePreview, and ResultSummary with an authored text fixture shared by the rendered source and raw/download actions. Metadata rows, comparison tables, and supplied logo grids use existing Card, Badge, Table, BrandLogo, and mark components.

### Conversations

`conversation` requires an accessible `label` and accepts `class`. Its optional `header` and `footer` slots sit outside a labelled ordered list. Supply ConversationMessage components or native list items as its direct children to preserve the transcript's order and semantics. For growing transcripts, callers supply a bounded page of messages and compose their loading or pagination controls in the container slots.

`conversation-message` requires `speaker` and accepts optional `role` and `class`. `IConversationRole`, exported from `jg-personal-astro-ui/contracts`, is `user | assistant | system | tool`. Roles are optional display labels; they do not infer a provider, participant identity, or workflow. Each message is a list item containing an article named by its supplied speaker and optional role.

The `avatar` slot is decorative beside the visible speaker; use non-interactive graphics and provide any remote-image fallback at the caller. The `content` slot holds prose, with ordinary children as its fallback. The separate `artifact` slot retains available width for FilePreview, FileTree, code, or other rich content. The `footer` slot can contain a supplied timestamp or actions. Missing optional slots render no placeholder content. There is no transcript parser, provider catalog, automatic timestamp formatting, or client state.

### File presentation

`file-preview` accepts a required `path`, optional `label`, caller-supplied `status`, and `class`. It renders the path and status in its raised caption, `header-actions` beside them, ordinary children on the `bg-code` background, and an optional `footer`. Compose CodeBlock or CodeDiff with `appearance="plain"` to inherit that code palette. Source scrolling stays with those components; the caption and actions remain outside that scroll body. Copy, source, raw, and download actions remain caller-owned compositions using the existing controls.

`file-tree` accepts `entries`, an accessible caption `label` (default `Files`), and `class`. Import `IFileTreeEntry` and `IFileStatus` from `jg-personal-astro-ui/contracts`. Each entry has `name`, optional `href` and `status`, and either `kind: 'file'` or `kind: 'directory'` with `children`. Statuses are `added`, `modified`, `removed`, and `unchanged`; they display text and semantic badges without inferring Git or filesystem state. Links are ordinary anchors, directories stay expanded, and nested lists retain their hierarchy. An empty input displays “No files to preview.”

The tree renders at most 256 entries and 8 levels, with root entries at level one. Traversal stops before reading entries beyond that budget and does not count the omitted remainder. Ancestor cycles omit further children; the same object in separate branches is allowed. Any omission shows “Partial preview. Some entries are not shown.” No total is invented. These are fixed preview bounds, not a filesystem browser or an interactive ARIA tree. Supplied arrays must be dense; content and links remain validated at their owning site boundary.

### Documentation composition

`documentation-shell` accepts optional `navigation` groups (`label` and `items` containing `href`/`label`), `currentPath`, `navigationLabel` (default `Documentation`), and `class`. An exact `currentPath`/`href` match receives `aria-current="page"`; pass the same path format in both. Empty groups are omitted. The `header` slot precedes the reading grid, ordinary children are its content, `outline` supplies the right column, and `footer` follows the content. The outline slot renders once. The shell adds no main landmark, route loading, heading parsing, or scrollspy.

On screens below `lg`, page navigation groups use a native disclosure and the outline precedes the content. At `lg`, supplied groups and an outline occupy side columns around the reading column. Either column can be omitted. Anchored elements inside the content receive a six-rem scroll margin for the shared sticky site header.

`documentation-outline` accepts a finite, acyclic `items` tree with `href`, `label`, and optional `children`; `label` defaults to `On this page`. It retains real nested lists and anchor links, uses a compact native disclosure below `lg`, and stays readable without JavaScript. An empty outline renders nothing. Callers own heading IDs and supply the hierarchy; no runtime heading scan is performed.

`page-navigation` accepts optional `previous` and `next` objects with `href`, `label`, and optional `description`. Visible Previous/Next names and `rel` attributes identify direction. A lone previous link aligns left and a lone next link aligns right on wider screens; links stack at phone widths. With neither link, it renders nothing. Its accessible `label` defaults to `Page navigation`.

```astro
<DocumentationShell
  navigation={groups}
  currentPath={Astro.url.pathname}
>
  <PageHeader
    slot="header"
    title="Reference"
    titleVariant="document"
  />
  <DocumentationOutline
    slot="outline"
    items={outline}
  />
  <Prose>
    <Content />
  </Prose>
  <PageNavigation
    slot="footer"
    previous={previousPage}
    next={nextPage}
  />
</DocumentationShell>
```

Import these components from their named `jg-personal-astro-ui` subpaths. Shared types come from `jg-personal-astro-ui/contracts`: `IDocumentationLink`, `IDocumentationNavigationGroup`, `IDocumentationOutlineItem`, and `IPageNavigationLink`. The types describe supplied presentation content; sites keep validation and content loading at their existing boundaries.

### Native accordion

Import `Accordion` from `jg-personal-astro-ui/accordion`. Supply a unique `id` and fallback `title`; `isOpen` defaults to false. `group` maps to the native details `name`, so opening one member closes another. Use a separate group for nested disclosures. Ordinary details attributes and `class` pass through.

The `summary` slot replaces the title with rich phrasing content such as a name and dates. `icon` is decorative; `status` contributes to the summary's accessible name. Keep links, buttons, and other interactive controls in the body rather than the summary. The `body` slot holds the expanded content; ordinary children are its fallback.

```astro
<Accordion
  id="experience"
  title="Project experience"
>
  <span slot="summary">
    Project experience <span>2020–present</span>
  </span>
  <Badge
    slot="status"
    variant="success"
  >
    Active
  </Badge>
  <p id="experience-detail">Experience details.</p>
</Accordion>
```

Native disclosure, focus, and exclusive grouping work without JavaScript. With JavaScript, initial fragments, hash changes, Astro navigation, and history restoration open collapsed details ancestors of targets inside an accordion, then reveal the target. The script does not move focus or rewrite history; native fragment navigation retains browser behavior. Percent-encoded IDs are supported; missing and malformed fragments are ignored. An already visible target does not cause extra scrolling. Status sits below the summary text on narrow screens and inline on larger screens. Chevron motion respects reduced motion.

## Navigation

Every page the package's components build crossfades into the next, and prerenders when the pointer rests on its link, without JavaScript:

- `contract.css` turns on cross-document view transitions with `@view-transition { navigation: auto; }`, with a 180 ms crossfade, and turns them off under `prefers-reduced-motion: reduce`. `document-head` repeats the opt-in and its reduced-motion opt-out in an inline style, because Chromium settles a page's opt-in when its body starts, and a stylesheet that arrives later would skip the transition with an unhandled error.
- `site-header` carries `view-transition-name: jg-site-header`, so the header stays still while the page under it changes. The footer moves with the page, because its position differs from page to page.
- `document-head` adds a `<script type="speculationrules">`, JSON the browser reads rather than code it runs. It prerenders same-site pages with `moderate` eagerness, which waits for the pointer to rest on a link, and never links to `.md`, `.txt`, `.xml` or `.png` files.

Chromium supports both, Safari only the transitions, and Firefox neither; where a browser doesn't, pages load as they always did.

`navigation-progress` covers the pages that are slow to arrive. A site's layout renders it once, and its script listens for clicks on the document:

- **When it shows:** 150 ms after a primary-button click, without modifier keys, on a link to another page of the same site in the same tab: no `target` but `_self`, no `download`, and more than a jump within the current page. A click a script already handled doesn't count. Prerendered and fast pages arrive first, so the bar never flashes on them.
- **When it hides:** the next page replaces it, a page restored from the back/forward cache hides it, and so does a 15-second stall, such as a link that downloaded a file.
- **Its look:** a 4 px bar in `--jg-foreground` on `--jg-background`, whose indicator sweeps across once a second. Under `prefers-reduced-motion: reduce` it's a still bar a third wide.
- **What it can't see:** the back and forward buttons, a typed URL, and a form submission load pages without a click it catches; the browser's own loading indicator covers them.

## Modules

| Subpath                                      | What it exports                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jg-personal-astro-ui/code-window`           | `renderCodeWindowHeader`, its header options, and `ICopyButtonDisplay`, for shared build-time code window markup                                    |
| `jg-personal-astro-ui/code-window-plugin`    | `codeWindowPlugin`, `createCodeWindowPlugin`, and `ICodeWindowPluginOptions`, for default or configured Sätteri code windows                        |
| `jg-personal-astro-ui/external-link-plugin`  | `externalLinkPlugin`, the Sätteri hast plugin that opens Markdown links to other sites in a new tab, with `rel="noreferrer"` and the new-tab marker |
| `jg-personal-astro-ui/new-tab-marker-markup` | `renderNewTabMarker`, the markup that ends a link opening a new tab, and `NEW_TAB_NOTICE`, its screen-reader text                                   |
| `jg-personal-astro-ui/syntax-theme`          | `SYNTAX_THEME`, the Shiki theme that colours code with the `--jg-syntax-*` properties                                                               |

A page's JSON-LD (`buildStructuredData`, `serializeStructuredData`, and `SEARCH_TEXT_LIMITS`), llms.txt (`buildLlmsText` and `buildLlmsFullText`), and the stored theme preference come from [jg-site](../packages/jg-site/README.md), which the components use too. The events between `theme-control` and `theme-init-script` stay inside the package.

Tabs render every panel with a visible label and a panel-anchor link before enhancement. Complete groups then become ARIA tablists with one focusable tab, Arrow/Home/End navigation, and Enter/Space activation. `storageKey` restores valid choices and synchronizes compatible groups on the page, including when browser storage is blocked. Nested groups retain their own state. Selection scrolls only the horizontal strip; it leaves the document position unchanged. The `actions` slot and terminal variant remain available.

`dialog` accepts `size="sm" | "md" | "lg"` (24rem, 40rem, and 56rem maxima), `mobilePresentation="floating" | "fullscreen"`, `isOverlayCloseEnabled`, and `initialFocus` (a CSS selector scoped to the dialog). Defaults remain `md`, `floating`, and enabled backdrop dismissal. A missing or invalid focus selector retains native initial focus. The body resets on reopening, its header stays visible, and owned background styles and page coordinates are restored when the last dialog closes. A removed opener falls back to a nearby control, parent dialog title, or page landmark.

Phone fullscreen dialogs fit the dynamic viewport and respect safe-area insets. Each opening owns a same-URL history entry below 40rem. Back closes the topmost owned dialog; other dismissal traverses only its current owned entry. Forward never reopens a dismissed dialog. Astro swaps and page dismissal release owned resources without consuming unrelated navigation. A small idempotent inline relay runs before deferred routers so owned history traversals do not start an Astro page transition.

`search-dialog` defaults to `title="Search"`, `inputLabel="Search the site"`, and `placeholder="Search the packages"`; all three are configurable. `title` names both the trigger and dialog. It retains the 150ms debounce, eight-result maximum, and shared Pagefind index load per configured path. Loading and outcomes use a persistent status region, errors expose a keyboard-accessible retry action, and touch input text is at least 16px. Closing or navigating cancels queued queries and invalidates stale completions; reopening searches the retained input. A retry refreshes a failed module URL while successful indexes remain shared. No second search engine or index cache is introduced.

## Private gallery

The repository's `packages/jg-personal-astro-ui/gallery/` renders the public component inventory across foundations, interactions, documentation, and technical content pages. `gallery/src/catalog/` maps each Astro export to a rendered example. Examples import only public package subpaths; the token contract detects component classes from the installed package and the gallery stylesheet detects its own templates. Markdown examples execute the Sätteri plugins, and the build creates a real Pagefind index.

```bash
pnpm --filter jg-personal-astro-ui gallery:dev
pnpm --filter jg-personal-astro-ui gallery:build
pnpm --filter jg-personal-astro-ui test:integration
pnpm --filter jg-personal-astro-ui test:e2e
```

The E2E suite serves the build only at `http://127.0.0.1:4332/`, refuses to reuse an existing server, and runs all three browser engines. Its preview wrapper owns Astro's child process tree and stops it on stdin EOF, SIGINT, SIGTERM, or child failure. `JG_UI_GALLERY_ROOT` optionally selects an absolute consumer root with its own installed Astro and built gallery; it is a local verification override. Default preview resolution uses this package's development installation. Global `NODE_PATH` entries never supply Astro for a selected consumer.

The preview integration tests exercise real CLI/descendant teardown in a temporary consumer without a pre-existing build. `test:coverage` includes unit and integration tests; `test` additionally runs browser tests and gallery E2E. Package typechecking includes the private gallery. The package-local Turbo graph serializes typechecking after the package build and E2E after typechecking to avoid concurrent Astro syncs.

The gallery stays out of the public website's routes and catalog, the npm allowlist, and deployed website output. Its examples cover the current supported behavior; the gallery is a verification tool rather than a public documentation site.

The light theme's keyword color maintains readable contrast on both added and removed diff backgrounds. Gallery axe checks cover these rendered syntax tokens in both themes.

## Releasing it

It's checked like every other package, plus the rendered gallery: `release:verify` copies the maintained gallery into an isolated consumer, installs the exact UI and required sibling tarballs with the checked-in tool versions, builds its pages and Pagefind index, and runs the same Playwright scenarios in all three browser engines. The fixture checks the packed export inventory and owns bounded commands, shutdown, and cleanup. [`releasing.md`](releasing.md) covers its limits and failure handling.
