// the browser globals the package reads. Each is optional, because server rendering, workers, and
// older browsers lack some of them
type IClipboardGlobals = {
  isSecureContext?: boolean;
  navigator?: {
    clipboard?: Partial<Clipboard>;
    userActivation?: { isActive: boolean };
    permissions?: { query?: (descriptor: { name: string }) => Promise<{ state: PermissionState }> };
  };
  document?: { hasFocus?: () => boolean };
  ClipboardItem?: {
    new (items: Record<string, string | Blob | PromiseLike<string | Blob>>): ClipboardItem;
    supports?: (type: string) => boolean;
  };
  DOMParser?: typeof DOMParser;
  createImageBitmap?: (image: Blob) => Promise<ImageBitmap>;
  OffscreenCanvas?: new (width: number, height: number) => OffscreenCanvas;
};

// read on every call, never when the module loads, so nothing runs at import
export const browserGlobals = globalThis as unknown as IClipboardGlobals;

/**
 * Reads the clipboard, which only a secure context exposes.
 * @returns The clipboard, or undefined outside a secure context or without one.
 */
export const getSecureClipboard = (): Partial<Clipboard> | undefined =>
  browserGlobals.isSecureContext === true ? browserGlobals.navigator?.clipboard : undefined;

/**
 * Checks whether the browser can write a type through ClipboardItem. Without ClipboardItem.supports,
 * only the types every browser must accept count: text/plain, text/html, and image/png.
 * @param type The MIME type.
 * @returns Whether ClipboardItem exists and accepts the type.
 */
export const supportsItemType = (type: string): boolean => {
  const item = browserGlobals.ClipboardItem;
  if (typeof item !== 'function') {
    return false;
  }
  return typeof item.supports === 'function'
    ? item.supports(type)
    : ['text/plain', 'text/html', 'image/png'].includes(type);
};
