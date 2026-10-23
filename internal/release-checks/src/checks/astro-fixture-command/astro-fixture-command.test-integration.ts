import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ERRORS, isProcessRunning, startProcess, stopProcessTree } from 'jg-process';
import { expect, test } from 'vitest';

import { runAstroFixtureCommand } from './index.ts';

// a process and descendant that stay alive until their owner stops the group
const worker = `
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
writeFileSync(join(process.argv[1], 'pids.json'), JSON.stringify([process.pid, child.pid]));
setInterval(() => {}, 1000);
`;

/** Removes owned command output only after the recorded processes have stopped. */
const removeCommandRoot = async (root: string): Promise<void> => {
  const pids = await readFile(join(root, 'pids.json'), 'utf8').then(
    (source) => JSON.parse(source) as number[],
    () => [],
  );
  if (pids.some(isProcessRunning))
    throw new Error(`Command processes remain alive; evidence retained at ${root}`);
  await rm(root, { recursive: true, force: true });
};

/** Owns one temporary command root and preserves evidence if a process remains alive. */
const withCommandRoot = async (check: (root: string) => Promise<void>): Promise<void> => {
  const root = join(tmpdir(), `jg-ui-command-${randomUUID()}`);
  await mkdir(root);
  try {
    await check(root);
  } finally {
    await removeCommandRoot(root);
  }
};

test('a command deadline stops the real child and descendant before returning', async () => {
  await withCommandRoot(async (root) => {
    await expect(
      runAstroFixtureCommand(process.execPath, ['-e', worker, root], {
        cwd: root,
        signal: new AbortController().signal,
        timeoutSeconds: 2,
      }),
    ).rejects.toMatchObject({ code: ERRORS.PROCESS_TIMED_OUT });
    const pids = JSON.parse(await readFile(join(root, 'pids.json'), 'utf8')) as number[];
    expect(pids).toHaveLength(2);
    expect(pids.some(isProcessRunning)).toBe(false);
    await expect(access(root)).resolves.toBeUndefined();
  });
});

test('combined output is bounded and the overflowing child is stopped', async () => {
  await withCommandRoot(async (root) => {
    const output = `
      const {writeFileSync}=require('node:fs');
      const {join}=require('node:path');
      writeFileSync(join(process.argv[1], 'pids.json'), JSON.stringify([process.pid]));
      const chunk=Buffer.alloc(1024*1024,120);
      for(let index=0;index<65;index++)process.stdout.write(chunk);
      setInterval(()=>{},1000);
    `;
    await expect(
      runAstroFixtureCommand(process.execPath, ['-e', output, root], {
        cwd: root,
        signal: new AbortController().signal,
        timeoutSeconds: 10,
      }),
    ).rejects.toMatchObject({ code: ERRORS.PROCESS_OUTPUT_TOO_LARGE });
    const pids = JSON.parse(await readFile(join(root, 'pids.json'), 'utf8')) as number[];
    expect(pids.some(isProcessRunning)).toBe(false);
  });
});

test('the executor preserves nonzero and signal exits', async () => {
  await withCommandRoot(async (root) => {
    const options = { cwd: root, signal: new AbortController().signal, timeoutSeconds: 10 };
    expect(
      await runAstroFixtureCommand(process.execPath, ['-e', 'process.exitCode=7'], options),
    ).toMatchObject({ exitCode: 7, signalCode: null });
    expect(
      await runAstroFixtureCommand(
        process.execPath,
        ['-e', "process.kill(process.pid,'SIGTERM')"],
        options,
      ),
    ).toMatchObject({ exitCode: null, signalCode: 'SIGTERM' });
  });
});

test.each(['SIGINT', 'SIGTERM'] as const)(
  'the gallery propagates %s after real teardown and cleanup',
  async (signal) => {
    await withCommandRoot(async (root) => {
      const fixtureModule = pathToFileURL(resolve(import.meta.dirname, '../astro-fixture.ts')).href;
      const commandModule = pathToFileURL(join(import.meta.dirname, 'index.ts')).href;
      const uiRoot = resolve(import.meta.dirname, '../../../../../packages/jg-personal-astro-ui');
      const script = `
      import {readFile,writeFile,access} from 'node:fs/promises';
      import {join} from 'node:path';
      import {checkAstroFixture} from ${JSON.stringify(fixtureModule)};
      import {runAstroFixtureCommand} from ${JSON.stringify(commandModule)};
      const manifest=JSON.parse(await readFile(join(${JSON.stringify(uiRoot)},'package.json'),'utf8'));
      const packed={packedManifest:manifest,tarballPath:'/release/ui.tgz',workspacePackage:{directory:${JSON.stringify(uiRoot)}}};
      const names=[...new Set(['jg-process','jg-playwright',...Object.keys(manifest.dependencies).filter(name=>name.startsWith('jg-'))])];
      const packages=[packed,...names.map(name=>({packedManifest:{name},tarballPath:'/release/'+name+'.tgz'}))];
      let calls=0;
      let consumer='';
      try {
        await checkAstroFixture(packages,()=>{throw new Error('legacy runner used')},async(_command,_args,options)=>{
          calls++;
          consumer=options.cwd;
          await writeFile(join(${JSON.stringify(root)},'consumer.json'),JSON.stringify(consumer));
          return runAstroFixtureCommand(process.execPath,['-e',${JSON.stringify(worker)},consumer],options);
        });
        throw new Error('Interruption did not propagate');
      }catch(error){
        const removed=await access(consumer).then(()=>false,()=>true);
        process.stdout.write(JSON.stringify({code:error.code,message:error.message,calls,removed}));
        process.exitCode=2;
      }
    `;
      const child = startProcess(process.execPath, ['--input-type=module', '-e', script], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk;
      });
      let consumer = '';
      try {
        await expect
          .poll(
            async () => {
              try {
                consumer = JSON.parse(
                  await readFile(join(root, 'consumer.json'), 'utf8'),
                ) as string;
                return (JSON.parse(await readFile(join(consumer, 'pids.json'), 'utf8')) as number[])
                  .length;
              } catch {
                return 0;
              }
            },
            { timeout: 10_000, message: 'the gallery worker starts before interruption' },
          )
          .toBe(2);
        const pids = JSON.parse(await readFile(join(consumer, 'pids.json'), 'utf8')) as number[];
        const closed = once(child, 'close');
        child.kill(signal);
        const [code] = (await closed) as [number | null, NodeJS.Signals | null];
        expect(stderr).toBe('');
        expect(code).toBe(2);
        expect(JSON.parse(stdout)).toStrictEqual({
          code: ERRORS.PROCESS_INTERRUPTED,
          message: `The process was interrupted by ${signal}.`,
          calls: 1,
          removed: true,
        });
        expect(pids.some(isProcessRunning)).toBe(false);
        await expect(access(consumer)).rejects.toMatchObject({ code: 'ENOENT' });
      } finally {
        await stopProcessTree(child);
      }
    });
  },
);
