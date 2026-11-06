# Changelog

## 0.6.1

### Fixed

- Require `jg-react-ui` 0.6.1, which keeps the caret visible when a chat message scrolls. Qualify click placement and drag selection at phone and desktop widths in both themes.

## 0.6.0

### Added

- Re-export `jg-react-ui` 0.6.0's opt-in technical chat tools and public tool type. The existing simple default remains unchanged.
- Add a technical formatting switch to the private editor gallery, with code/table authoring and live-theme qualification.

## 0.5.1

### Fixed

- The README links `API.md` and `RECIPES.md` at this version, where they pointed at 0.3.3, and jg-react-ui's current error contracts, which it also names for the audio codes it had placed in an `errors/README.md` this package doesn't ship.
- Requires `jg-react-ui` 0.5.1, whose README and error contracts link the current docs.

## 0.5.0

### Added

- Re-exports jg-react-ui 0.5.0's `ResponsiveDialog`, `ClampedText`, `PathText`, `Avatar`, `Illustration`, `RouteLoadError`, `QueryFailure`, `ViewNav` and `InnerPageBar`, the bottom `Drawer`, `Markdown`'s `headingLevelOffset` and `LoadMoreButton`'s `autoLoad`, each from the root and its own `components/*` entry.
- Re-exports jg-react-ui 0.5.0's fixes: `QueryErrorAlert` keeps a long error code within a 320px screen, and `ChatMarkdownEditor`'s literal appends keep `~`, `<` and `&`.
- The gallery's app patterns page composes them with the JG styles, and its browser tests check the bottom sheet's geometry and swipe on a 320px phone, the dialog's focus return, auto-loading, the route reload notice, coarse-pointer targets, and both themes at 320, 768 and 1280px.

## 0.4.0

### Added

- Re-exports the direct-apply recorder and full-dictation editor APIs from `jg-react-ui` 0.4.0. Standalone AudioInput review remains available.
- The editor gallery demonstrates distinct main-input Transcribe and ordinary message Send, complete overflow retention, explicit message retry, and fresh document/undo state after successful submission.

## 0.3.4

### Fixed

- Requires `jg-react-ui` 0.3.5, whose Markdown editors keep the focus, with the caret at the end, when they take a changed `value`, no longer report that value back as an edit, and whose chat editor counts a message without the line break its Markdown ends with.

## 0.3.3

### Changed

- Requires `jg-react-ui` 0.3.4, whose `CopyButton` copies through jg-clipboard's `copyText` and shows jg-react's `useCopyFeedback` state.

## 0.3.2

### Added

- Requires `jg-react-ui` 0.3.3: `CopyButton`'s `value` can be a function that reads the text after the click, and `ChatMarkdownEditor`'s `isShiftEnterSubmit` makes Shift+Enter submit.

## 0.3.1

### Fixed

- Requires `jg-react-ui` 0.3.1: Tab and Shift+Tab leave the chat Markdown editor outside list items, `DEFAULT_FORM_PROPS` validates on touch so a fixed field's error clears at once, and `Switch` keeps a 44px target on touch screens.

## 0.3.0

- Add CodeDiff with the bundled checked viewer, lazy worker chunk, native folding controls, and retained public props.

- Add the retained compact, wide, automatic, and chat Markdown editors with direct shared APIs, selection tools, and caller-owned upload/dictation compositions.
- Preserve draft bounds, initialization safety, keyboard formatting, focus return, and 44px coarse-pointer editor controls.

- Add Markdown, full code typography, syntax highlighting, code preference controls, and validated YouTube embeds through shared implementations.
- Wrap long inline tokens inside shrinkable message columns, contain code/table scrolling, and preserve unlabelled code fences.

- Add retained file queues, upload dialogs, controlled image fields, and audio recording/transcription APIs with caller-owned adapters.
- Release obsolete media requests and deferred controls, preserve Strict Mode status notifications, and recover failed image previews.

- Add source-compatible routing, query loaders/boundaries, pagination and safe error recovery, reusing shared query state with scoped application policy.
- Prevent duplicate refresh/retry requests and preserve 44px recovery targets under coarse pointers.

- Add retained dialogs, alert decisions, drawers, confirmation sessions, and semantic layout primitives, with shared router dismissal and JG theme bindings.

- Add Moldea-derived forms, select/choice controls, tabs, menus, tooltips, copy feedback, progress, empty states, plain typography, tables, links, and inline code with direct shared implementations.
- Preserve native composition, cancellation, focus/ref and slot behavior, with JG token bindings, touch typography, and reduced-motion styles.

### Added

- Scoped error-feedback policy for application-owned messages and access-loss decisions.
- Isolated, namespaced UI preferences with local, read-only, and ordered remote persistence; pre-paint theme initialization, theme controls, and themed notifications.
- Storage-ID validation aligned with jg-storage and nullable dismissal resets.

## 0.2.0

### Added

- Shared Badge, IconTile, and Alert exports, JG status colors, and the decorative JgMark component.

## 0.1.0

### Added

- Direct re-exports of the shared Button and preference contracts with JG fonts, palettes, token bindings, and an optional system-theme utility fallback.
