# Changelog

## 0.6.1

### Fixed

- Keep the chat editor's caret visible at the active editing position after scrolling by using Milkdown's supported native-caret configuration. Floating formatting controls and document-editor cursor behavior remain intact.

## 0.6.0

### Added

- Add opt-in chat inline code, fenced code blocks and tables through `supportedTools` and `IChatMarkdownEditorTool`, retaining the seven-tool default.

### Fixed

- Route Ctrl/Cmd+Enter through the existing chat submission callback from embedded code editors, with composition and read-only guards.
- Keep floating chat formatting controls outside the scrolling document so Firefox and WebKit can activate them.
- Ignore changes from detached editors during asynchronous destruction so an old draft cannot return after submission.
- Preserve backslashes in code that resembles a template variable; variable formatting stays in the existing text-node serializer.
- Map chat code carets and selections to live theme tokens without remounting the editor or losing editing state.

## 0.5.1

### Fixed

- The README links `API.md`, `RECIPES.md` and `errors/README.md` at this version, where they pointed at 0.3.4.
- `errors/README.md` links jg-react's current API reference, where it pointed at 0.6.1, and `INVALID_YOUTUBE_VIDEO_ID`'s contract in jg-utilities' API reference, where it pointed at an `errors/README.md` jg-utilities doesn't ship.

## 0.5.0

### Added

- `Drawer` takes `side: 'bottom'`, a bottom sheet that spans the view's width, grows with its content up to all but 3rem of the view's height, closes with a swipe down, and skips the notch inset that only a side drawer needs.
- `ResponsiveDialog`, which opens a `Dialog` from the md breakpoint up and a bottom sheet below it, with the same title, description and body, `initialFocus` for the dialog and `sheetInitialFocus` for the sheet.
- `ClampedText`, a text clamped to 2 to 6 lines with Show all only when the clamp cuts it off and Show less after, controlled or on its own, with details beside the toggle.
- `PathText`, which breaks a path or identifier after `/`, `\`, `_`, `.` and `-` with `<wbr>`, which copying leaves out.
- `Avatar`, an image on a fixed-size tile, xs to xl, filling it or inset as a logo, with the first character of its fallback in the same tile when there's no image or it fails to load.
- `Illustration`, decorative drawings in the theme's tokens for an empty list, conversation or checklist, an error, and being offline.
- `RouteLoadError`, a route error element for `ROUTE_MODULE_UNAVAILABLE` from jg-react-router 0.5.0, which offers Reload after an update or offline and passes every other error on.
- `QueryFailure`, a `QueryBoundary` error alert that illustrates a first read that failed, and says when the browser is offline.
- `ViewNav`, a row of link buttons for a page's views that scrolls sideways with complete labels, and `InnerPageBar`, an inner page's sticky bar with Back to the page it was reached from, its title and its actions, whose height is `--inner-page-bar-height`.
- `Markdown` takes `headingLevelOffset`, which lowers its headings so a document nests under the page's own.
- `LoadMoreButton` takes `autoLoad` and `autoLoadMargin`, which load the next page as the control nears the viewport, and again while it stays near, keeping the button for keyboards.

### Fixed

- `QueryErrorAlert` no longer widens a 320px screen when its error code is long: its text grids have explicit single columns, so the code truncates inside the alert.
- `ChatMarkdownEditor`'s `appendLiteralText` keeps `~`, `<` and `&` literal, so dictated `~~text~~`, tags and entities no longer turn into strikethrough, HTML or characters, and a controls handle kept after the editor unmounts appends nothing instead of reporting a change.

## 0.4.0

### Added

- `AudioInput` supports direct main-input Transcribe through `onTranscriptionApply` while retaining a separate Send callback and standalone review defaults. `isResultActionVisible` allows a sole direct-apply action.
- `ChatMarkdownEditor.appendLiteralText` accepts `{ allowOverLimit: true }` to retain complete dictation before readiness and allow editing oversized drafts. Ordinary insertion stays bounded and read-only editors reject insertion.

### Changed

- The recorder uses compact accessible icon actions and shows pending progress only in the active button. Pending actions retain focus and reject repeated activation, restart and dismissal. Portalled recorder submissions stay inside the dialog.

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
