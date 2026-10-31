/**
 * Normalizes the maximum progress range used by the shared progress bar.
 * @param max The caller-provided maximum value.
 * @returns A positive finite maximum, or 100 when the provided value is invalid.
 */
export const normalizeProgressMax = (max: number | undefined): number => {
  if (max === undefined || !Number.isFinite(max) || max <= 0) {
    return 100;
  }

  return max;
};

/**
 * Clamps a determinate progress value into the active progress range.
 * @param value The caller-provided progress value.
 * @param max The normalized maximum progress range.
 * @returns A finite value between 0 and max.
 */
export const normalizeProgressValue = (value: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(max, Math.max(0, value));
};
