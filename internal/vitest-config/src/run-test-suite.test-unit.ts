import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

// the repository root, three levels above this file
const ROOT = join(import.meta.dirname, '..', '..', '..');

/**
 * Reads the complementary coverage groups in the complete check command.
 * @param commands The complete check command.
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

test('pnpm check:full preserves complementary coverage groups', () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const check = readCoverageFilters(scripts['check:full'] ?? '');

  expect(check.chromium.length).toBeGreaterThan(0);
  expect(check.shared).toStrictEqual(check.chromium.map((name) => `!${name}`).sort());
});

test('CI browser images match the workspace Playwright version', () => {
  const workspace = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const version = /^ {2}'@playwright\/test': (\d+\.\d+\.\d+)$/mu.exec(workspace)?.[1];
  expect(version).toBeDefined();
  expect(workspace).toContain(`  playwright: ${version}\n`);

  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  const images = [
    ...workflow.matchAll(/image: (mcr\.microsoft\.com\/playwright:v[^\s]+-noble)/gu),
  ].map(([, image]) => image);
  expect(images).toStrictEqual(Array(3).fill(`mcr.microsoft.com/playwright:v${version}-noble`));
});
