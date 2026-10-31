import { Exception } from 'jg-exception';

// the private gallery replaces only these provider responses in browser tests.
export type IInputOperation = 'upload' | 'finalize' | 'transcribe' | 'send';

/**
 * Exercises an abortable provider boundary without transmitting selected files or recordings.
 * @param operation The fixed example operation to exercise.
 * @param signals The owning screen and optional upload cancellation signals.
 * @returns A promise that resolves when the fixture response is available.
 * @throws
 * - GALLERY_INPUT_UNAVAILABLE: Private gallery input diagnostics
 */
export const waitForInputProvider = async (
  operation: IInputOperation,
  signals: AbortSignal[],
): Promise<void> => {
  const response = await fetch(`/route-ready.txt?input=${operation}`, {
    signal: AbortSignal.any([...signals, AbortSignal.timeout(10_000)]),
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Exception('Private gallery input diagnostics', {
      code: 'GALLERY_INPUT_UNAVAILABLE',
    });
  }
};
