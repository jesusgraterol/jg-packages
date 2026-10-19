// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from './errors.js';
import { readSuccessfulOutput } from './utilities.js';

describe('readSuccessfulOutput', () => {
  // Compose's diagnostics can quote the project's configuration, such as a password
  const result = { stdout: 'out', stderr: 'POSTGRES_PASSWORD: hunter2', durationMs: 1 };

  test('gives the stdout of a command that exited with 0', () => {
    expect(readSuccessfulOutput({ ...result, exitCode: 0, signalCode: null }, 'compose ps')).toBe(
      'out',
    );
  });

  test.each([
    [15, null],
    [null, 'SIGKILL'],
  ] as const)('throws without stderr for exit code %s', (exitCode, signalCode) => {
    let error: unknown;
    try {
      readSuccessfulOutput({ ...result, exitCode, signalCode }, 'compose ps');
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'compose ps', exitCode },
    });
    expect(JSON.stringify(error)).not.toContain('hunter2');
  });
});
