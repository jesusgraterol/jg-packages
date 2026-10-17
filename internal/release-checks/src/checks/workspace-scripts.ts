import type { IWorkspace } from '../workspace/workspace.ts';

// the scripts of the suites `pnpm check` runs through each workspace's test:coverage
const SUITE_SCRIPTS = ['test:unit', 'test:integration'];

// the script that runs a workspace's suites, once, with coverage
const COVERAGE_SCRIPT = 'test:coverage';

/**
 * The workspace check: every workspace with unit or integration tests has a test:coverage script,
 * because that's how `pnpm check` runs them. It reads the manifests directly, so a cached
 * Turborepo task can never hide a workspace whose tests dropped out.
 * @param workspaces Every workspace.
 * @returns One problem per workspace without the script.
 */
export const checkWorkspaceScripts = (workspaces: IWorkspace[]): string[] =>
  workspaces.flatMap(({ manifest }) => {
    const scripts = manifest.scripts ?? {};
    const suites = SUITE_SCRIPTS.filter((script) => scripts[script] !== undefined);
    return suites.length === 0 || scripts[COVERAGE_SCRIPT] !== undefined
      ? []
      : [
          `${manifest.name} has ${suites.join(' and ')} but no ${COVERAGE_SCRIPT}, so pnpm check never runs its tests`,
        ];
  });
