// what the browser lets the page do with the clipboard, each from feature detection
export type IClipboardSupport = {
  // whether the page is in a secure context, such as HTTPS or localhost, which the clipboard needs
  isSecureContext: boolean;

  // whether copyText can run
  copyText: boolean;

  // whether copyHtml can run
  copyHtml: boolean;

  // whether copyImage can run
  copyImage: boolean;

  // whether readText can run
  readText: boolean;

  // whether readClipboard can run
  read: boolean;
};

// what copyHtml accepts besides the HTML
export type ICopyHtmlOptions = {
  // the plain text pasted where HTML can't go. Defaults to the HTML's text content
  text?: string | Promise<string>;
};

// what readClipboard found, with null for each kind of content the clipboard doesn't hold
export type IClipboardContent = {
  text: string | null;
  html: string | null;

  // the image, as PNG
  image: Blob | null;
};

// the clipboard operation a failure happened in
export type IClipboardOperation = 'write' | 'read';
