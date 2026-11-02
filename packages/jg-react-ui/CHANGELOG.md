# Changelog

## 0.3.1

### Fixed

- The chat Markdown editor's Tab and Shift+Tab move the focus to the next or previous control, as they do from a text field, instead of indenting the message; in a list item they still nest and lift it.
- `DEFAULT_FORM_PROPS` checks a field once it first loses focus, then at every change (`mode: 'onTouched'`), so a field's error goes away as soon as it's fixed rather than at its next blur.
- `Switch` keeps a 44px target around its track on touch screens.

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

- Retained Badge, IconTile, and Alert APIs with their variants, types, and slotted rendering.

## 0.1.0

### Added

- Moldea-derived Button variants, sizes, badges, native props, refs, and child rendering, with coarse-pointer touch sizing preserved on tablets.
- Consumer-owned theme roles, class composition, and complete UI preference schemas and defaults.
