import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isProcessRunning,
  reservePort,
  startProcess,
  stopProcessTree,
  waitForUrl,
} from 'jg-process';
import { expect, test } from 'vitest';

// a real CLI and descendant exercise lifecycle without depending on a prebuilt Astro gallery
const fixtureCli = `
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
await writeFile(join(process.cwd(), 'pids.json'), JSON.stringify([process.pid, descendant.pid]));
createServer((_request, response) => response.end('ready')).listen(port, '127.0.0.1');
`;

/** Runs the real preview wrapper against a temporary consumer and always removes its tree. */
const withPreview = async (
  cli: string | null,
  check: (child: ChildProcess, root: string, url: string) => Promise<void>,
): Promise<void> => {
  const root = join(tmpdir(), `jg-ui-preview-${randomUUID()}`);
  await mkdir(root);
  let child: ChildProcess | undefined;
  const reservation = await reservePort();
  const port = reservation.port;
  try {
    if (cli !== null) {
      const packageRoot = join(root, 'node_modules', 'astro');
      await mkdir(packageRoot, { recursive: true });
      await writeFile(
        join(packageRoot, 'package.json'),
        JSON.stringify({ name: 'astro', type: 'module', bin: { astro: './cli.mjs' } }),
      );
      await writeFile(join(packageRoot, 'cli.mjs'), cli);
    }
    await reservation.release();
    child = startProcess(
      process.execPath,
      [join(import.meta.dirname, 'preview.ts'), '--port', String(port)],
      {
        env: { ...process.env, JG_UI_GALLERY_ROOT: root },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    await check(child, root, `http://127.0.0.1:${String(port)}/`);
  } finally {
    await reservation.release();
    if (child !== undefined) {
      child.stdin?.end();
      await stopProcessTree(child);
    }
    await rm(root, { recursive: true, force: true });
  }
};

test.each(['eof', 'SIGINT', 'SIGTERM'] as const)(
  'preview stops its CLI and descendant on %s',
  async (ending) => {
    await withPreview(fixtureCli, async (child, root, url) => {
      await waitForUrl(url, { timeoutSeconds: 10, child });
      const pids = JSON.parse(await readFile(join(root, 'pids.json'), 'utf8')) as number[];
      expect(pids.every(isProcessRunning)).toBe(true);
      const exited = once(child, 'exit');
      if (ending === 'eof') child.stdin?.end();
      else child.kill(ending);
      const [code] = (await exited) as [number | null, NodeJS.Signals | null];
      expect(code).toBe(ending === 'eof' ? 0 : ending === 'SIGINT' ? 130 : 143);
      await expect.poll(() => pids.some(isProcessRunning)).toBe(false);
    });
  },
);

test('preview preserves a failing CLI exit', async () => {
  await withPreview('process.exitCode = 7;', async (child) => {
    const [code] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
    expect(code).toBe(7);
  });
});

test('preview rejects a consumer with no Astro installation', async () => {
  await withPreview(null, async (child) => {
    let stderr = '';
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    const [code] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
    expect(code).toBe(1);
    expect(stderr).toContain('Cannot find module');
    expect(stderr).toContain('astro');
  });
});
