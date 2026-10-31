// the suites a run can select: essential skips useful secondary coverage tagged `full`
export type ITestSuite = 'essential' | 'full';

// useful secondary coverage, classified by consequence rather than test duration
export const FULL_TEST_TAG = 'full';

/**
 * Reads the suite the JG_TEST_SUITE environment variable selects. It imports nothing, so a
 * Playwright config can read the suite without loading Vitest.
 * @param env The environment to read. Defaults to process.env.
 * @returns `'full'` when the variable is unset, otherwise its value.
 * @example
 * const suite = readTestSuite(); // 'full' unless JG_TEST_SUITE=essential
 * @throws
 * - JG_TEST_SUITE must be "essential" or "full" when set.
 */
export const readTestSuite = (env: NodeJS.ProcessEnv = process.env): ITestSuite => {
  const value = env['JG_TEST_SUITE'];
  if (value === undefined) {
    return 'full';
  }
  if (value === 'essential' || value === 'full') {
    return value;
  }
  throw new Error('JG_TEST_SUITE must be "essential" or "full" when set.');
};
