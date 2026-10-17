import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runCommand } from './shared/run-command.ts';

// runs the command-line tool with the given arguments
const runCli = (args: string[]) =>
  runCommand(process.execPath, [join(import.meta.dirname, 'cli.ts'), ...args]);

describe('the release command-line tool', () => {
  test.each([
    [['publish'], 'Missing --from.'],
    [['tag', '--from', 'release'], 'Missing --published.'],
    [['pack'], 'Missing --out.'],
    [['release'], 'Unknown command: release'],
    [[], 'Unknown command: (none)'],
    [['verify', 'extra'], 'Unexpected arguments: extra'],
  ])('cli(%o) -> prints the problem and the usage, and exits 2', async (args, message) => {
    const { exitCode, stderr } = await runCli(args);

    expect(exitCode).toBe(2);
    expect(stderr).toContain(message);
    expect(stderr).toContain('Usage: node internal/release-checks/src/cli.ts <command>');
  });

  test('rejects options it does not know', async () => {
    const { exitCode, stderr } = await runCli(['publish', '--from', 'release', '--force']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown option '--force'");
  });
});
