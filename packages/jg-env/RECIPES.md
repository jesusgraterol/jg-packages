# jg-env recipes

Patterns for reading a program's configuration once, at startup, from the environment and from secret files.

## A configuration module for a Node.js service

Read every setting in one module, at startup, so a missing or malformed one stops the service before it serves anything. Node.js loads a `.env` file itself, so local development needs no other package:

```ts
import { createEnvironmentReader } from 'jg-env';
import { fileURLToPath } from 'node:url';

import { createSecretReader } from 'jg-env/node';
import { z } from 'zod';

// containers set their variables themselves; local development reads them from .env
if (process.env['IS_RUNNING_IN_CONTAINER'] !== 'true') {
  process.loadEnvFile(new URL('../.env', import.meta.url));
}

const { readBoolean, readEnum, readInteger, readJson, readOptionalString, readString } =
  createEnvironmentReader(process.env);
const { readSecret } = createSecretReader({
  isRunningInContainer: readBoolean('IS_RUNNING_IN_CONTAINER'),
  secretsDirectoryPath: fileURLToPath(new URL('../secrets/', import.meta.url)),
});

export const CONFIG = {
  nodeEnv: readEnum('NODE_ENV', ['development', 'production', 'test']),
  port: readInteger('PORT'),
  database: {
    host: readString('DATABASE_HOST'),
    password: readSecret('DATABASE_PASSWORD'),
  },
  allowedOrigins: readJson('ALLOWED_ORIGINS', z.array(z.url())),
  sentryDsn: readOptionalString('SENTRY_DSN'),
} as const;
```

Errors name the variable, never its value, so the startup failure can go to the logs as it is.

## A browser app's configuration with Vite

Vite puts the app's `VITE_` variables in `import.meta.env`, next to its own booleans, such as `DEV`. The readers take the whole record, and read only the strings:

```ts
import { createEnvironmentReader } from 'jg-env';

const { readOptionalBoolean, readString } = createEnvironmentReader(import.meta.env);

export const API_ORIGIN = readString('VITE_API_ORIGIN');
export const SHOW_BETA_BANNER = readOptionalBoolean('VITE_SHOW_BETA_BANNER') ?? false;
```

Vite replaces `import.meta.env` when it builds, so every variable the app reads is in the bundle. Never put a secret in a `VITE_` variable.

## Docker secrets in a container and in local development

In Compose, a secret's file appears under `/run/secrets`, and the service's variable points at it. Locally, the same secret is a file in a directory Git ignores:

```ts
import { fileURLToPath } from 'node:url';

import { createSecretReader } from 'jg-env/node';
import { z } from 'zod';

// compose.yaml sets STRIPE_SECRET_KEY=/run/secrets/STRIPE_SECRET_KEY in the container;
// local development keeps the key in secrets/STRIPE_SECRET_KEY.txt
const { readSecret, readSecretJson } = createSecretReader({
  isRunningInContainer: process.env['IS_RUNNING_IN_CONTAINER'] === 'true',
  secretsDirectoryPath: fileURLToPath(new URL('../secrets/', import.meta.url)),
});

export const STRIPE_SECRET_KEY = readSecret('STRIPE_SECRET_KEY');
export const FIREBASE_OPTIONS = readSecretJson(
  'FIREBASE_OPTIONS',
  z.object({ projectId: z.string(), apiKey: z.string() }),
);
```

A secret is read as it is, so write its file without a trailing newline, as `printf '%s' "$KEY" > secrets/STRIPE_SECRET_KEY.txt` does. An empty file fails with `ENV_SECRET_FILE_UNREADABLE`.

## A base `.env` with a private overlay

Keep the settings every developer shares in a committed `.env`, and each developer's secrets in an uncommitted `.env.local` that only its owner can read. Read both without touching `process.env`, let the shell or the container override either, and read the merged variables once, at startup:

```ts
import { fileURLToPath } from 'node:url';

import { createEnvironmentReader } from 'jg-env';
import { mergeEnvSources, readEnvFile } from 'jg-env/node';

const root = fileURLToPath(new URL('..', import.meta.url));

const isRunningInContainer = process.env['IS_RUNNING_IN_CONTAINER'] === 'true';

// a container gets its variables from its own configuration, so it reads no file
const variables = isRunningInContainer
  ? mergeEnvSources(process.env)
  : mergeEnvSources(
      readEnvFile(`${root}.env`),
      // a missing overlay is fine; one that others can read stops the start, with its path
      readEnvFile(`${root}.env.local`, { requirePrivate: true, rootPath: root, isOptional: true }),
      process.env,
    );

const { readInteger, readString } = createEnvironmentReader(variables);

export const CONFIG = {
  port: readInteger('PORT'),
  apiKey: readString('PAYMENTS_API_KEY'),
} as const;
```

Create the overlay with `install -m 600 /dev/null .env.local` on POSIX, so it's private from the start, and add it to `.gitignore`. The base file can be read by anyone, so it holds no secrets.
