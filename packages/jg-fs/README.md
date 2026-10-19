# jg-fs

Filesystem helpers for Node.js, async at the root and sync at `jg-fs/sync`: paths, directories, text, JSON, atomic and bounded files.

## Install

```bash
npm install jg-fs
```

## Usage

The root entry is async, and `jg-fs/sync` has the same functions, synchronous:

```ts
import { readJsonFile, writeFileAtomic, writeJsonFile, writeTextFile } from 'jg-fs';
import { readTextFile } from 'jg-fs/sync';
import { z } from 'zod';

const Config = z.object({ port: z.number() });

await writeTextFile('notes/today.md', '# Today'); // creates notes/ when it's missing
const config = await readJsonFile('config.json', { schema: Config }); // validated, and typed by the schema
await writeJsonFile('config.json', { ...config, port: 3000 }); // atomic: readers never see a partial file
await writeFileAtomic('state.txt', 'step 2'); // any content, atomically
const upload = await readJsonFile('uploads/import.json', { maxBytes: 1_048_576 }); // FILE_TOO_LARGE past 1 MB

const readme = readTextFile('README.md');
```

List, filter, and sort a directory:

```ts
import { getDirectoryElements } from 'jg-fs';

const { files, directories } = await getDirectoryElements('content', {
  includeExts: ['.md'],
  sortByKey: 'creation',
  sortOrder: 'desc',
});
```

Read files from untrusted paths with a size limit, without following a symbolic link:

```ts
import { isPathWithin, readBoundedFile } from 'jg-fs';

if (isPathWithin(uploadsDirectory, path)) {
  const upload = await readBoundedFile(path, 5 * 1024 * 1024);
}
```

Keep a job from running twice at once, across processes on one machine, with a lock:

```ts
import { acquireLock } from 'jg-fs';

const lock = await acquireLock('.locks/nightly-report'); // LOCK_BUSY while another process holds it
try {
  await buildNightlyReport();
} finally {
  await lock.release();
}
```

The lock is a directory holding an `owner.json` that names the process. When its owner's process is gone, as after a crash, the next `acquireLock` on the same host takes it over. Use it on local filesystems only: a lock is never taken over from another host.

Keep keys, tokens, and sessions private to the user who owns them:

```ts
import { createPrivateDirectory, readPrivateFile, writePrivateFile } from 'jg-fs';

await createPrivateDirectory(configDirectory); // 0o700; DIRECTORY_NOT_PRIVATE if it exists and isn't
await writePrivateFile(`${configDirectory}/token.json`, token, { rootPath: configDirectory }); // atomic, 0o600
const saved = await readPrivateFile(`${configDirectory}/token.json`, {
  maxBytes: 16 * 1024,
  rootPath: configDirectory,
});
```

A private file is a regular file, never a symbolic link, with no symbolic link anywhere in its path (`PATH_NOT_CANONICAL`), and without group or other permissions (`FILE_NOT_PRIVATE`). The checks run on the open file, so the content read is the content checked. A shared file is never overwritten, and permissions are never changed for you: fix them, or remove the file. `writePrivateFile` with `isExclusive` creates the file and throws `FILE_ALREADY_EXISTS` when anything is already at the path.

On Windows, Node.js reports only a file's read-only attribute as its mode, so the permission checks are skipped there. A private file on Windows depends on its directory's access control list, such as a directory inside the user's profile.

Failures throw `Exception`s from `jg-exception`, with the codes in `ERRORS`.

### Removing a stuck lock

A lock left in a state no process can safely take over stays busy, and `LOCK_BUSY`'s `data.reason` says why:

- `held`: the owner named in `owner.json` is still running. Wait, or stop that process.
- `other-host`: the owner runs on another host, which this host can't check.
- `ownerless`: `owner.json` is missing or invalid, such as after a crash right after the directory was created. A lock being created or released at that moment looks the same, so try again first.
- `recovery-in-progress`: a `recovery` directory is inside, so another process is taking the lock over, or crashed while doing so.
- `unexpected-entries`: the directory holds something besides `owner.json`, such as a `.tmp` file left by an interrupted write.

Before deleting a stuck lock's directory by hand, confirm that no process is using it: check the `pid` and `hostname` in `owner.json`, when there is one. Then delete the whole directory.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-fs/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-fs/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-fs/LICENSE)
