// fixed tools exposed by the compact chat authoring surface.
export const CHAT_MARKDOWN_EDITOR_TOOLS = [
  'text',
  'heading',
  'bold',
  'italic',
  'link',
  'bullet-list',
  'ordered-list',
] as const;

// default editor height keeps a growing chat draft compact before it scrolls.
export const CHAT_MARKDOWN_EDITOR_DEFAULT_MAX_HEIGHT = 256;

// user-facing policy feedback is stable across editor and composer integrations.
export const CHAT_MARKDOWN_EDITOR_NORMALIZED_MESSAGE =
  'Some pasted formatting was simplified to keep this message safe and compatible.';
export const CHAT_MARKDOWN_EDITOR_PASTE_TOO_LONG_MESSAGE =
  'The pasted content is longer than the message limit. Your draft was not changed.';
