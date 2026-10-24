import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

// the repository root, three levels above this file
const ROOT = join(import.meta.dirname, '..', '..', '..');

/**
 * Reads the turbo filters of the two coverage runs in a script or workflow.
 * @param commands The commands, such as the root check script or the CI workflow file.
 * @returns The sorted filters of the --concurrency=4 run and of the one-at-a-time Chromium run.
 */
const readCoverageFilters = (commands: string): { shared: string[]; chromium: string[] } => {
  const runs = commands.match(/run-test-suite\.ts full run test:coverage[^&\n]*/gu) ?? [];
  const readFilters = (concurrency: string): string[] => {
    const run = runs.find((candidate) => candidate.includes(`--concurrency=${concurrency}`)) ?? '';
    return [...run.matchAll(/--filter='?([^'\s]+)'?/gu)].map(([, filter]) => filter ?? '').sort();
  };
  return { shared: readFilters('4'), chromium: readFilters('1') };
};

test('pnpm check runs coverage in the same two groups as the CI tests job', () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const check = readCoverageFilters(scripts['check'] ?? '');
  const ci = readCoverageFilters(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));

  expect(check.chromium.length).toBeGreaterThan(0);
  expect(check).toStrictEqual(ci);
  expect(check.shared).toStrictEqual(check.chromium.map((name) => `!${name}`).sort());
});
