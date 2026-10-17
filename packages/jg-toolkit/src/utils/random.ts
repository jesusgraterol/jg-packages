// the number of distinct values one 32-bit draw yields
const UINT32_RANGE = 2 ** 32;

// the number of distinct values one 53-bit draw yields, the integers a double represents exactly
const UINT53_RANGE = 2 ** 53;

// the most 32-bit values crypto.getRandomValues fills in one call (65,536 bytes)
const MAX_UINT32_BATCH = 16_384;

// draws 32-bit random values, refilling its buffer from crypto.getRandomValues as needed
export type IUint32Source = () => number;

/**
 * Creates a source of cryptographically secure 32-bit values that fills a buffer in batches, so
 * long strings and shuffles don't call `crypto.getRandomValues` once per value.
 * @param expectedDraws How many values the caller expects to draw, used to size the buffer.
 * @returns The source.
 */
export const createUint32Source = (expectedDraws: number): IUint32Source => {
  const buffer = new Uint32Array(Math.min(Math.max(Math.ceil(expectedDraws), 1), MAX_UINT32_BATCH));
  let index = buffer.length;
  return () => {
    if (index >= buffer.length) {
      crypto.getRandomValues(buffer);
      index = 0;
    }
    const value = buffer[index] ?? 0;
    index += 1;
    return value;
  };
};

/**
 * Draws a uniformly distributed integer in `[0, span)` with rejection sampling: draws in the
 * incomplete last block of the 32-bit range are discarded, so no index is more likely than another.
 * @param span The number of possible results, between 1 and 2^32.
 * @param nextUint32 The source of 32-bit values.
 * @returns The drawn integer.
 */
export const drawUniformIndex = (span: number, nextUint32: IUint32Source): number => {
  const limit = UINT32_RANGE - (UINT32_RANGE % span);
  let value = nextUint32();
  while (value >= limit) {
    value = nextUint32();
  }
  return value % span;
};

/**
 * Draws a uniformly distributed 53-bit integer, from 21 bits of one draw and 32 bits of another.
 * @param nextUint32 The source of 32-bit values.
 * @returns An integer in `[0, 2^53)`.
 */
const drawUint53 = (nextUint32: IUint32Source): number =>
  (nextUint32() >>> 11) * UINT32_RANGE + nextUint32();

/**
 * Draws a uniformly distributed integer in `[0, span)` for spans up to 2^53, with rejection
 * sampling over 53-bit values. Larger spans can't be represented exactly, so they scale a 53-bit
 * fraction instead.
 * @param span The number of possible results, at least 1.
 * @param nextUint32 The source of 32-bit values.
 * @returns The drawn integer.
 */
export const drawUniformInteger = (span: number, nextUint32: IUint32Source): number => {
  if (span <= UINT32_RANGE) {
    return drawUniformIndex(span, nextUint32);
  }
  if (span > UINT53_RANGE) {
    return Math.floor(drawFloat(nextUint32) * span);
  }
  const limit = UINT53_RANGE - (UINT53_RANGE % span);
  let value = drawUint53(nextUint32);
  while (value >= limit) {
    value = drawUint53(nextUint32);
  }
  return value % span;
};

/**
 * Draws a uniformly distributed number in `[0, 1)` with 53 bits of randomness, the full precision
 * of a double.
 * @param nextUint32 The source of 32-bit values.
 * @returns The drawn number.
 */
export const drawFloat = (nextUint32: IUint32Source): number =>
  drawUint53(nextUint32) / UINT53_RANGE;
