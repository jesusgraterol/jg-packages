import { Exception } from 'jg-exception';

// stable public error codes
export const ERRORS = {
  INVALID_HTML_RENDER_OPTIONS: 'INVALID_HTML_RENDER_OPTIONS',
  HTML_RENDER_FAILED: 'HTML_RENDER_FAILED',
} as const;

type IReason =
  | 'browser'
  | 'options'
  | 'cancelled'
  | 'timeout'
  | 'context'
  | 'page'
  | 'network'
  | 'font'
  | 'image'
  | 'layout'
  | 'overflow'
  | 'capture'
  | 'invalid-png'
  | 'cleanup';

/**
 * Uses a fixed diagnostic because Playwright and callback errors can contain markup or asset URLs.
 * @param reason The safe description of the failed operation.
 * @returns The corresponding public error.
 */
export const renderError = (reason: IReason): Exception => {
  const invalid = reason === 'browser' || reason === 'options';
  return new Exception(
    invalid ? 'The HTML render options are invalid.' : 'The HTML could not be rendered to PNG.',
    {
      code: invalid ? ERRORS.INVALID_HTML_RENDER_OPTIONS : ERRORS.HTML_RENDER_FAILED,
      data: { reason },
    },
  );
};
