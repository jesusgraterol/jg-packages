# jg-fs

Filesystem helpers for Node.js, async at the root and sync at `jg-fs/sync`: paths, directories, text, JSON, atomic and bounded files.

## Install

```bash
npm install jg-fs
```

## Usage

The root entry is async, and `jg-fs/sync` has the same functions, synchronous:

```ts
import { readJsonFile, writeFileAtomic, writeTextFile } from 'jg-fs';
import { readTextFile } from 'jg-fs/sync';
import { z } from 'zod';

const Config = z.object({ port: z.number() });

await writeTextFile('notes/today.md', '# Today'); // creates notes/ when it's missing
const config = await readJsonFile('config.json', { schema: Config }); // validated, and typed by the schema
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

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-fs/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-fs/LICENSE)
