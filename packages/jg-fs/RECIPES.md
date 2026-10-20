# jg-fs recipes

Patterns for Node.js apps that keep their files whole through crashes, and read files from users within a size limit.

## A config file that's never half-written

Use this for a file the app reads at startup and rewrites while it runs, such as settings changed from an admin page. A plain write that's cut short, by a crash or a full disk, leaves a truncated file that won't parse at the next start. `writeJsonFile` writes a temporary file next to it, flushes it to disk, and renames it over the old one, so the file holds either the old config or the new one:

```ts
import { hasErrorCode } from 'jg-exception';
import { ERRORS, readJsonFile, writeJsonFile } from 'jg-fs';

// the config's type, from your schema
type IConfig = ReturnType<typeof Config.parse>;

const CONFIG_PATH = 'data/config.json';

// what the app runs with until someone saves a change
const DEFAULT_CONFIG: IConfig = { port: 8080 };

export const loadConfig = async (): Promise<IConfig> => {
  try {
    // Config is your schema, such as a Zod object, so a file edited by hand into a wrong shape
    // fails here, at startup, instead of somewhere later
    return await readJsonFile(CONFIG_PATH, { schema: Config });
  } catch (error) {
    // nothing was saved yet
    if (hasErrorCode(error, ERRORS.NON_EXISTENT_FILE)) {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
};

// the update in progress, which the next one waits for
let pendingUpdate: Promise<unknown> = Promise.resolve();

// reads, changes, and saves the config one update at a time, so two updates never start from
// the same version and lose one of the changes
export const updateConfig = (change: (config: IConfig) => IConfig): Promise<IConfig> => {
  const update = pendingUpdate.then(async () => {
    const config = change(await loadConfig());
    await writeJsonFile(CONFIG_PATH, config);
    return config;
  });

  // a failed update rejects for its caller, and the next one still runs
  pendingUpdate = update.catch(() => undefined);
  return update;
};

await updateConfig((config) => ({ ...config, port: 3000 }));
```

`writeFileAtomic` writes any other content the same way, and both try again for a few seconds while Windows refuses the rename because a scanner holds the file. A symbolic link at the path keeps pointing at the config. Any error other than a missing file propagates, such as `FILE_CONTENT_IS_EMPTY_OR_INVALID` for a file that isn't JSON, or the schema's own error, so the app never starts from a config it can't trust. The atomic write keeps each save whole, but doesn't order saves: the queue does that inside one process, and when several processes write the file, give it one owner. A crash during a save can leave a temporary `.<random>.tmp` file next to the config, which is safe to delete.

`jg-fs/sync` has the same functions without promises, for code that can't await, such as an `exit` handler or a short CLI command. An explicit mode keeps a secret private from the first byte written:

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from 'jg-fs/sync';

// the token your CLI's login command received
declare const token: string;

// kept outside any project, so it's never committed with one
const credentialsPath = join(homedir(), '.my-cli', 'credentials.json');

// on POSIX, only the owner can read it, and the temporary file is never more widely readable
writeFileAtomic(credentialsPath, JSON.stringify({ token }), 0o600);
```

Without a mode, a replaced file keeps its permission bits, so a config someone restricted with `chmod` stays restricted after the app saves it.

## Reading uploads with a size limit

Use this when a request names a file that someone uploaded earlier, such as an import or an attachment, and the app reads it into memory. The name comes from a client, and the file can be larger than you expect, so the read checks three things: the path stays inside the uploads directory, the file is a regular file and not a symbolic link, and its size is within a limit:

```ts
import { join, resolve } from 'node:path';
import { Exception, hasErrorCode } from 'jg-exception';
import { ERRORS, isPathWithin, readBoundedFile } from 'jg-fs';

// where your upload handler saves files, a directory that only the app writes to
const UPLOADS_DIRECTORY = resolve('uploads');

// the largest upload the app loads into memory
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// reads an upload by the name a request gave, such as 'report.csv'. The messages name the upload
// and not the server's path, and the cause keeps jg-fs's error for the logs
export const readUpload = async (name: string): Promise<Buffer> => {
  // a name such as '../.env' leads outside the directory, which counts as not found
  const path = join(UPLOADS_DIRECTORY, name);
  if (!isPathWithin(UPLOADS_DIRECTORY, path)) {
    throw new Exception('The upload was not found.', {
      code: 'UPLOAD_NOT_FOUND',
      data: { name },
    });
  }
  try {
    return await readBoundedFile(path, MAX_UPLOAD_BYTES);
  } catch (error) {
    // a missing file, or a directory or a symbolic link someone planted
    if (hasErrorCode(error, ERRORS.NON_EXISTENT_FILE) || hasErrorCode(error, ERRORS.NOT_A_FILE)) {
      throw new Exception('The upload was not found.', {
        code: 'UPLOAD_NOT_FOUND',
        data: { name },
        cause: error,
      });
    }
    if (hasErrorCode(error, ERRORS.FILE_TOO_LARGE)) {
      throw new Exception('The upload is too large to read.', {
        code: 'UPLOAD_TOO_LARGE',
        data: { name, maxBytes: MAX_UPLOAD_BYTES },
        cause: error,
      });
    }
    throw error;
  }
};
```

`readBoundedFile` checks the size before it reads, and reads at most one byte past the limit, so a file that grows during the read can't make it load more. It refuses a symbolic link as the last part of the path, but follows links in the directories above it, which is why the uploads go in a directory that only the app writes to. A request handler can answer `UPLOAD_NOT_FOUND` with a 404, and `jg-fs/sync` has the same `readBoundedFile` for code that can't await.
