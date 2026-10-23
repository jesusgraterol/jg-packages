import type { IAstroFixtureLimits } from './types.ts';

// half of the release job is available to the fixture; per-stage limits never extend it
export const ASTRO_FIXTURE_LIMITS: IAstroFixtureLimits = {
  total: 15 * 60,
  install: 5 * 60,
  build: 5 * 60,
  index: 60,
  browser: 10 * 60,
};

// combined stdout and stderr captured by any one command
export const ASTRO_FIXTURE_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
