import { createRequire } from 'node:module';
import { dirname, isAbsolute, join } from 'node:path';
import { parseArgs } from 'node:util';

import { createShutdownSignal, startProcess, stopProcessTree } from 'jg-process';

// Playwright owns stdin. Closing its pipe also stops the preview after a killed test runner.
const { values } = parseArgs({ options: { port: { type: 'string', default: '4178' } } });
const port = Number(values.port);
if (!/^\d+$/u.test(values.port) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('The gallery preview port must be an integer from 1 to 65535.');
}
const root = process.env['JG_REACT_UI_GALLERY_ROOT'] ?? import.meta.dirname;
if (!isAbsolute(root)) {
  throw new Error('JG_REACT_UI_GALLERY_ROOT must be an absolute path.');
}

// resolve from the selected consumer, never from the workspace when testing an installed tarball
const require = createRequire(join(root, 'package.json'));
// absolute lookup prevents NODE_PATH inherited from pnpm shims from supplying workspace Vite
const dependencyRoot = process.env['JG_REACT_UI_GALLERY_ROOT'] === undefined ? dirname(root) : root;
const vitePackageFile = require.resolve(
  join(dependencyRoot, 'node_modules', 'vite', 'package.json'),
);
const { bin } = require(vitePackageFile) as { bin: { vite: string } };
const viteEntry = join(dirname(vitePackageFile), bin.vite);
const shutdown = createShutdownSignal();
let requestStop: () => void = () => undefined;
const stopping = new Promise<number>((resolve) => {
  requestStop = () => resolve(0);
});
process.stdin.once('end', requestStop);
shutdown.signal.addEventListener('abort', requestStop, { once: true });
process.stdin.resume();

const child = startProcess(
  process.execPath,
  [
    viteEntry,
    'preview',
    '--config',
    join(dependencyRoot, 'vite.config.ts'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
  },
);
try {
  const completed = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  const exitCode = await Promise.race([completed, stopping]);
  if (!shutdown.signal.aborted) process.exitCode = exitCode;
} finally {
  try {
    await stopProcessTree(child);
  } finally {
    process.stdin.off('end', requestStop);
    process.stdin.pause();
    shutdown.signal.removeEventListener('abort', requestStop);
    shutdown.dispose();
  }
}
