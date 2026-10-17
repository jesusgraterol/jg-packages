// reading-time calculation values based on an average adult reading speed
const AVERAGE_READING_WORDS_PER_MINUTE = 200;
const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Estimates how long text takes to read at 200 words per minute.
 * @param text The text whose reading time will be estimated.
 * @returns The estimated reading time in milliseconds, or 0 for non-string or empty input.
 * @example
 * estimateReadingTime(article); // milliseconds, such as 180000 for about 600 words
 * prettifyTime(estimateReadingTime(article)); // '3m'
 */
export const estimateReadingTime = (text: unknown): number => {
  if (typeof text !== 'string') {
    return 0;
  }

  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return 0;
  }

  const wordCount = normalizedText.split(/\s+/).length;

  return Math.ceil((wordCount * MILLISECONDS_PER_MINUTE) / AVERAGE_READING_WORDS_PER_MINUTE);
};
