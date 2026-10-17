import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { findWorkspaces } from './workspace.ts';

let rootDirectory: string;

// writes a workspace's package.json
const writeManifest = async (path: string, name: string): Promise<void> => {
  await mkdir(join(rootDirectory, path), { recursive: true });
  await writeFile(join(rootDirectory, path, 'package.json'), JSON.stringify({ name }));
};

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'jg-release-workspaces-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('findWorkspaces', () => {
  test('finds every directory the patterns name that has a package.json, private ones included', async () => {
    await writeFile(
      join(rootDirectory, 'pnpm-workspace.yaml'),
      'packages:\n  - internal/*\n  - packages/*\n  - website\n',
    );
    await writeManifest('internal/tool', '@scope/tool');
    await writeManifest('packages/jg-a', 'jg-a');
    await mkdir(join(rootDirectory, 'packages', 'not-a-package'));
    await writeManifest('website', '@scope/website');

    const workspaces = await findWorkspaces(rootDirectory);

    expect(workspaces.map(({ manifest }) => manifest.name)).toStrictEqual([
      '@scope/tool',
      'jg-a',
      '@scope/website',
    ]);
    expect(workspaces[0]?.directory).toBe(join(rootDirectory, 'internal', 'tool'));
  });

  test("rejects a pattern it can't read, rather than skipping its workspaces", async () => {
    await writeFile(join(rootDirectory, 'pnpm-workspace.yaml'), 'packages:\n  - apps/**\n');

    await expect(findWorkspaces(rootDirectory)).rejects.toThrow(
      "pnpm-workspace.yaml has a pattern the release checks can't read: apps/**",
    );
  });

  test('fails without a pnpm-workspace.yaml', async () => {
    await expect(findWorkspaces(rootDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
