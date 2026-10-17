# jg-fs

Filesystem helpers for Node.js, async at the root and sync at `jg-fs/sync`: paths, directories, text, JSON, atomic and bounded files.

## Install

```bash
npm install jg-fs
```

## Usage

The root entry is async, and `jg-fs/sync` has the same functions, synchronous:

```ts
import { readJSONFile, writeFileAtomic, writeTextFile } from 'jg-fs';
import { readTextFile } from 'jg-fs/sync';

await writeTextFile('notes/today.md', '# Today'); // creates notes/ when it's missing
const config = await readJSONFile<{ port: number }>('config.json');
await writeFileAtomic('state.json', JSON.stringify(state)); // readers never see a partial file

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

Failures throw `Exception`s from `jg-exception`, with the codes in `ERRORS`.

## Coming from `fs-utils-async` and `fs-utils-sync`

| Old                              | `jg-fs`                      |
| -------------------------------- | ---------------------------- |
| `import … from 'fs-utils-async'` | `import … from 'jg-fs'`      |
| `import … from 'fs-utils-sync'`  | `import … from 'jg-fs/sync'` |
| the codes, not exported          | `ERRORS`                     |

Changed behavior:

- Empty content is allowed. `readTextFile`, `readBufferFile`, and `readFile` return empty content instead of throwing, and `writeTextFile('')` and `writeBufferFile` with an empty Buffer write empty files. `FILE_CONTENT_IS_EMPTY_OR_INVALID` now means data of the wrong type, or JSON that is empty or can't be parsed or stringified. Code that relied on the throw to detect empty files needs its own check.
- `createDirectory` succeeds when the directory already exists, keeping its contents. It throws `DIRECTORY_ALREADY_EXISTS` only when a file or something else that isn't a directory is at the path.
- `includeExts` matches extensions case-insensitively, so `.JSON` and `.json` are the same.
- The sync `readDirectory` joins paths with the platform's separator, and the sync `getDirectoryElements` skips entries removed while it reads the directory, as the async one already did.
- The async `getDirectoryElements` reads at most 32 entries at once.
- `readFile` returns `string` when given an encoding and `Buffer` otherwise, instead of `string | Buffer`.
- Errors are `Exception`s from `jg-exception`, with the same codes.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-fs/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-fs/LICENSE)
