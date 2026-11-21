import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { ERRORS, runForegroundProcess, runProcess } from '../index.js';

const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url));
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-foreground-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('inherits input and output, passes options and returns the child exit code', async () => {
  const childScript = String.raw`
    process.stdout.write('prompt\n');
    process.stderr.write('diagnostic\n');
    process.stdin.setEncoding('utf8');
    let received = '';
    process.stdin.on('data', (chunk) => { received += chunk; });
    process.stdin.on('end', () => {
      process.stdout.write(JSON.stringify({
        received,
        arg: process.argv[1],
        cwd: process.cwd(),
        env: process.env.JG_FOREGROUND_TEST,
      }) + '\n');
      process.exitCode = 17;
    });
  `;
  const runnerScript = `
    import { runForegroundProcess } from 'jg-process';
    const result = await runForegroundProcess(
      process.execPath,
      ['-e', ${JSON.stringify(childScript)}, 'literal ; &'],
      { cwd: process.argv[1], env: { ...process.env, JG_FOREGROUND_TEST: 'selected' } },
    );
    process.stdout.write(JSON.stringify(result) + '\\n');
  `;
  const result = await runProcess({
    command: process.execPath,
    args: ['--input-type=module', '-e', runnerScript, directory],
    cwd: PACKAGE_DIRECTORY,
    input: 'terminal input\n',
    timeoutSeconds: 10,
  });
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('diagnostic\n');
  expect(result.stdout.split('\n')).toStrictEqual([
    'prompt',
    JSON.stringify({
      received: 'terminal input\n',
      arg: 'literal ; &',
      cwd: await realpath(directory),
      env: 'selected',
    }),
    '{"exitCode":17,"signalCode":null}',
    '',
  ]);
});

test('rejects a missing executable with the established launch error', async () => {
  const command = join(directory, 'missing-executable');
  await expectToRejectCode(
    runForegroundProcess(command, []),
    ERRORS.PROCESS_START_FAILED,
    `Unable to start '${command}'.`,
  );
});

test('maps an immediate spawn validation failure to the same launch error', async () => {
  const running = runForegroundProcess('', []);
  await expectToRejectCode(running, ERRORS.PROCESS_START_FAILED, "Unable to start ''.");
  await expect(running).rejects.toHaveProperty('cause.name', 'TypeError');
});
