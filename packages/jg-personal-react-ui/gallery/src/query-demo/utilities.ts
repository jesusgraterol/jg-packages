import { Exception } from 'jg-exception';

/**
 * Reads one record from the fixed private gallery fixture, respecting cancellation and a local request deadline.
 * @param page The fixture page, generated from the bounded four-page example.
 * @param signal The query's cancellation signal.
 * @returns The fixture's text.
 * @throws
 * - GALLERY_ACCESS_REVOKED: Private gallery response diagnostics
 * - GALLERY_UNAVAILABLE: Private gallery response diagnostics
 */
export const readGalleryRecord = async (page: number, signal: AbortSignal): Promise<string> => {
  const response = await fetch(`/records.txt?page=${page}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok)
    throw new Exception('Private gallery response diagnostics', {
      code: response.status === 403 ? 'GALLERY_ACCESS_REVOKED' : 'GALLERY_UNAVAILABLE',
    });
  return await response.text();
};
