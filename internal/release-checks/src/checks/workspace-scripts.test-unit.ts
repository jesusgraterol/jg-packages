import { describe, expect, test } from 'vitest';

import type { IWorkspace } from '../workspace/workspace.ts';
import { checkWorkspaceScripts } from './workspace-scripts.ts';

// builds a workspace with the given scripts
const workspace = (name: string, scripts?: Record<string, string>): IWorkspace => ({
  directory: `/repo/${name}`,
  manifest: { name, version: '0.0.0', ...(scripts === undefined ? {} : { scripts }) },
});

describe('checkWorkspaceScripts', () => {
  test('fails a workspace with unit or integration tests but no test:coverage', () => {
    expect(
      checkWorkspaceScripts([
        workspace('jg-unit', { 'test:unit': 'vitest run --project unit' }),
        workspace('jg-both', {
          'test:unit': 'vitest run --project unit',
          'test:integration': 'vitest run --project integration',
        }),
        workspace('jg-integration', { 'test:integration': 'vitest run --project integration' }),
      ]),
    ).toStrictEqual([
      'jg-unit has test:unit but no test:coverage, so pnpm check:full never runs its tests',
      'jg-both has test:unit and test:integration but no test:coverage, so pnpm check:full never runs its tests',
      'jg-integration has test:integration but no test:coverage, so pnpm check:full never runs its tests',
    ]);
  });

  test('passes a workspace with its tests and test:coverage', () => {
    expect(
      checkWorkspaceScripts([
        workspace('jg-covered', {
          'test:unit': 'vitest run --project unit',
          'test:coverage': 'vitest run --coverage --project unit',
        }),
      ]),
    ).toStrictEqual([]);
  });

  test('ignores a workspace without unit or integration tests', () => {
    expect(
      checkWorkspaceScripts([
        workspace('jg-config'),
        workspace('jg-e2e', { 'test:e2e': 'playwright test', 'test:browser': 'vitest run' }),
      ]),
    ).toStrictEqual([]);
  });
});
