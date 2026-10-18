import type { ISchema } from '../shared/index.js';

// where a secret reader finds each secret's file
export type ISecretReaderOptions = {
  // true where each secret's variable holds the path to its file, such as /run/secrets/DB_PASSWORD
  // in a container
  isRunningInContainer: boolean;

  // the directory that holds each secret as <KEY>.txt, used outside a container
  secretsDirectoryPath: string;
};

// reads secrets from files, at startup. A missing, unreadable, or empty file throws
// ENV_SECRET_FILE_UNREADABLE, and inside a container that error never names the path, since the
// path comes from a variable that might hold the secret itself by mistake
export type ISecretReader = {
  // reads a secret's file, as it is, without trimming
  readSecret: (key: string) => string;

  // reads a secret's file as JSON its schema accepts
  readSecretJson: <T>(key: string, schema: ISchema<T>) => T;
};
