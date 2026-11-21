import type { BrowserContextOptions, Page } from 'playwright';

// optional context defaults for trusted callers; offline and pixel settings are owned by the renderer
export type IOfflineRendererOptions = Pick<
  BrowserContextOptions,
  'colorScheme' | 'locale' | 'timezoneId'
> & {
  signal?: AbortSignal;
};

// each required @font-face is matched by family, and by weight or style when specified
export type IRequiredRenderFont = {
  family: string;
  weight?: string;
  style?: string;
};

// a prepared HTML document, its exact canvas, and the assets it is expected to use
export type IHtmlRenderInput = {
  html: string;
  width: number;
  height: number;
  requiredFonts?: IRequiredRenderFont[];
  transparent?: boolean;
  colorScheme?: BrowserContextOptions['colorScheme'];
  timeoutMs?: number;
  layout?: (page: Page) => Promise<void | 'overflow'>;
};

// the browser operations available inside one offline session
export type IOfflineRenderer = {
  /**
   * Prepares a page and passes it to trusted code, such as a PDF producer, until the callback settles.
   * @param input The HTML, canvas, asset and layout settings.
   * @param usePage Trusted work to run in the prepared page.
   * @returns The callback result after page cleanup.
   * @throws
   * - INVALID_HTML_RENDER_OPTIONS: The HTML render options are invalid.
   * - HTML_RENDER_FAILED: The HTML could not be rendered to PNG.
   */
  preparePage<T>(input: IHtmlRenderInput, usePage: (page: Page) => Promise<T>): Promise<T>;
  /**
   * Prepares a page and returns its exact-size PNG bytes.
   * @param input The HTML, canvas, asset and layout settings.
   * @returns The verified PNG bytes.
   * @throws
   * - INVALID_HTML_RENDER_OPTIONS: The HTML render options are invalid.
   * - HTML_RENDER_FAILED: The HTML could not be rendered to PNG.
   */
  renderPng(input: IHtmlRenderInput): Promise<Buffer>;
};
