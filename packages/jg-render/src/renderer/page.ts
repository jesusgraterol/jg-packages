import type { BrowserContext, Page } from 'playwright';

import { waitForAssets } from './assets.js';
import { renderError } from './errors.js';
import { beforeAbort, withCleanup } from './lifecycle.js';
import type { IHtmlRenderInput } from './types.js';

const MAX_VIEWPORT_EDGE = 8192;
const MAX_CANVAS_PIXELS = 4096 * 8192;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const validateInput = ({
  html,
  width,
  height,
  requiredFonts,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: IHtmlRenderInput): void => {
  const dimensionsValid = [width, height].every(
    (edge) => Number.isSafeInteger(edge) && edge > 0 && edge <= MAX_VIEWPORT_EDGE,
  );
  if (
    typeof html !== 'string' ||
    html.trim() === '' ||
    !dimensionsValid ||
    width * height > MAX_CANVAS_PIXELS ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS ||
    requiredFonts?.some(
      ({ family, weight, style }) =>
        typeof family !== 'string' ||
        family.trim() === '' ||
        (weight !== undefined && typeof weight !== 'string') ||
        (style !== undefined && typeof style !== 'string'),
    )
  )
    throw renderError('options');
};

/**
 * Creates and checks one isolated page in the session's context, then closes it after use.
 * @param context The owned Chromium context.
 * @param cancellation The session's cancellation signal.
 * @param input The prepared HTML and render options.
 * @param usePage The trusted work to run in the prepared page.
 * @returns The result after page cleanup.
 */
export const withPreparedPage = async <T>(
  context: BrowserContext,
  cancellation: AbortSignal | undefined,
  input: IHtmlRenderInput,
  usePage: (page: Page) => Promise<T>,
): Promise<T> => {
  validateInput(input);
  if (cancellation?.aborted) throw renderError('cancelled');
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = cancellation ? AbortSignal.any([cancellation, deadline]) : deadline;
  const opening = context.newPage().catch(() => {
    throw renderError('page');
  });

  return withCleanup(
    () =>
      beforeAbort(signal, cancellation, async () => {
        const page = await opening;
        if (signal.aborted) throw renderError(cancellation?.aborted ? 'cancelled' : 'timeout');
        let blocked = false;
        let browserError = false;
        let assetProblem: 'font' | 'image' | undefined;
        const assertPage = (): void => {
          if (blocked) throw renderError('network');
          if (assetProblem) throw renderError(assetProblem);
          if (browserError) throw renderError('page');
        };
        try {
          await page.route('**/*', (route) => {
            if (route.request().url().startsWith('data:')) return route.continue();
            blocked = true;
            return route.abort('blockedbyclient');
          });
          page.on('pageerror', () => {
            browserError = true;
          });
          page.on('console', (event) => {
            if (event.type() === 'error') browserError = true;
          });
          await page.setViewportSize({ width: input.width, height: input.height });
          if (input.colorScheme !== undefined)
            await page.emulateMedia({ colorScheme: input.colorScheme });
          await page.setContent(input.html, { waitUntil: 'load', timeout: timeoutMs });
          assetProblem = await waitForAssets(page, input.requiredFonts ?? []);
        } catch {
          assertPage();
          throw renderError('page');
        }
        assertPage();
        if (input.layout) {
          const layout = await Promise.resolve()
            .then(() => input.layout?.(page))
            .catch(() => {
              throw renderError('layout');
            });
          assertPage();
          if (layout === 'overflow') throw renderError('overflow');
        }
        if (signal.aborted) throw renderError(cancellation?.aborted ? 'cancelled' : 'timeout');
        const result = await usePage(page);
        assertPage();
        return result;
      }),
    async () => {
      const page = await opening.catch(() => undefined);
      if (page !== undefined && !page.isClosed()) await page.close();
    },
  );
};
