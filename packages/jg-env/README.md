# jg-env

Strict environment variable readers for browsers and Node.js, plus secret files, with errors that name the key and never the value.

## Install

```bash
npm install jg-env
```

## Usage

Read a service's settings once, at startup, and fail fast when one is missing or malformed:

```ts
import { createEnvironmentReader } from 'jg-env';

const { readBoolean, readEnum, readInteger, readString } = createEnvironmentReader(process.env);

export const NODE_ENV = readEnum('NODE_ENV', ['development', 'production', 'test']);
export const PORT = readInteger('PORT'); // only plain decimal digits, so 1e3 and 0x10 fail
export const DATABASE_HOST = readString('DATABASE_HOST');
export const MAINTENANCE_MODE = readBoolean('MAINTENANCE_MODE'); // exactly true or false
```

The same readers take any record of variables, such as Vite's `import.meta.env`, whose built-in fields are booleans: only string values count, and anything else is invalid. A variable that's absent, empty, or blank is unset. `readOptionalString`, `readOptionalBoolean`, `readOptionalInteger`, and `readOptionalJson` return `undefined` for an unset variable instead of throwing.

Read JSON settings through a schema, such as a Zod schema:

```ts
import { createEnvironmentReader } from 'jg-env';
import { z } from 'zod';

const { readJson } = createEnvironmentReader(process.env);

export const ALLOWED_ORIGINS = readJson('ALLOWED_ORIGINS', z.array(z.url()));
```

### Secret files

`jg-env/node` reads secrets kept in files, such as Docker secrets. Inside a container, the secret's variable holds the path to its file; elsewhere, the file is `<KEY>.txt` in a secrets directory:

```ts
import { fileURLToPath } from 'node:url';

import { createSecretReader } from 'jg-env/node';
import { z } from 'zod';

const { readSecret, readSecretJson } = createSecretReader({
  isRunningInContainer: process.env['IS_RUNNING_IN_CONTAINER'] === 'true',
  secretsDirectoryPath: fileURLToPath(new URL('../secrets/', import.meta.url)),
});

export const DATABASE_PASSWORD = readSecret('DATABASE_PASSWORD'); // as it is, without trimming
export const ROOT_ACCOUNT = readSecretJson('ROOT_ACCOUNT', z.object({ email: z.email() }));
```

### Environment files

`jg-env/node`'s `readEnvFile` reads a `.env` file's variables into a record, without changing `process.env`, so a base file and a local overlay can be merged, in order, with `mergeEnvSources`, and then read as any other source:

```ts
import { createEnvironmentReader } from 'jg-env';
import { mergeEnvSources, readEnvFile } from 'jg-env/node';

const environment = createEnvironmentReader(
  mergeEnvSources(
    readEnvFile('.env'), // the shared defaults
    readEnvFile('.env.local', { requirePrivate: true, isOptional: true }), // secrets, if present
    process.env, // what the shell or the container sets wins
  ),
);
```

The file is read as UTF-8, at most `maxBytes`, 65,536 by default, without a byte-order mark, and parsed by Node.js's `util.parseEnv`: quotes, multiline values in double quotes, `export`, and comments, with a later key winning and no `${...}` expansion. `parseEnv` skips a line it can't parse, such as one without `=`, rather than failing. With `requirePrivate`, the file must be private to its owner, `0o600` on POSIX, not reached through a symbolic link, and strictly inside `rootPath` when one is given. With `isOptional`, a missing file reads as `{}`. In `mergeEnvSources`, a later source wins and an undefined value is skipped, so it never hides an earlier one.

### Errors

| Code                         | When                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `ENV_VARIABLE_MISSING`       | A required variable is unset                                                                        |
| `ENV_VARIABLE_INVALID`       | A value isn't a string, an allowed value, `true` or `false`, a plain integer, JSON, or its schema's |
| `ENV_SECRET_FILE_UNREADABLE` | A secret's file is missing, unreadable, or empty                                                    |
| `ENV_FILE_UNREADABLE`        | A `.env` file is missing, without `isOptional`, isn't a regular file, or can't be read              |
| `ENV_FILE_NOT_PRIVATE`       | A `.env` file read with `requirePrivate` isn't private, goes through a link, or is outside its root |
| `ENV_FILE_TOO_LARGE`         | A `.env` file is larger than `maxBytes`                                                             |
| `ENV_FILE_INVALID`           | A `.env` file isn't valid UTF-8 text                                                                |

An error's message and data name the variable or the file, never a value. `ENV_VARIABLE_INVALID` has no `cause`, because a JSON parser's or a schema's error can quote the value. Inside a container, `ENV_SECRET_FILE_UNREADABLE` leaves out the path and the file system's error too, since a variable set to the secret itself by mistake would otherwise print it. `ENV_FILE_INVALID` has no `cause` either, so no byte of the file reaches a log.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-env/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-env/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-env/LICENSE)
