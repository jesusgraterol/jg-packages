// types
export type { IClipboardContent, IClipboardSupport, ICopyHtmlOptions } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// support
export { getClipboardSupport } from './support/index.js';

// copying
export { copyHtml, copyImage, copyText } from './copy/index.js';

// reading
export { readClipboard, readText } from './read/index.js';
