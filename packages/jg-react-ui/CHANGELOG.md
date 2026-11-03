# Changelog

## 0.3.5

### Fixed

- A Markdown editor that takes a changed `value` keeps the focus: it replaces the document as one edit, kept out of the undo history, with the caret at the end of the new text, where it used to rebuild its state and drop the focus. `ChatMarkdownEditor`'s `appendLiteralText` keeps the focus the same way.
- A Markdown editor no longer reports a `value` it took back through `onChange` as an edit, and a value that already describes its document, such as its own Markdown, leaves the document alone. Before, a value whose Markdown the editor writes differently made it take the same text a second time, which could drop what was typed in between.
- `ChatMarkdownEditor` counts a message without the line break its Markdown ends with, in its character count, its over-the-limit message and its paste check, so a message of exactly `maxLength` characters fits.

## 0.3.4

### Changed

- `CopyButton` copies through jg-clipboard's `copyText` and shows the copied state of jg-react's `useCopyFeedback`, in place of its own clipboard and feedback code, and depends on `jg-clipboard`. A failed copy still shows its toast, a cancelled one stays silent, and a `copiedFeedbackDuration` that isn't positive and finite throws `INVALID_COPY_FEEDBACK_DURATION`.

## 0.3.3

### Added

- `CopyButton`'s `value` can be a function that reads the text after the click, such as a document the page loads on demand. The copy calls the clipboard within the click, through a ClipboardItem that waits for the text, as Safari needs, or writes the text once it has loaded where the browser has no ClipboardItem; copied feedback shows once it's on the clipboard. `ICopyButtonProps` leaves out the button's native `value` attribute.
- `ChatMarkdownEditor`'s `isShiftEnterSubmit` makes Shift+Enter request submission too, as Ctrl+Enter and Cmd+Enter do, in place of a line break, never during IME composition.

## 0.3.2

### Fixed

- Text selected in a Markdown editor stays readable: light mode used the near-black primary color behind the text, which hid it, and dark mode's tint fell short of a 4.5:1 contrast. Both themes now tint the selection with the text's own color.

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
