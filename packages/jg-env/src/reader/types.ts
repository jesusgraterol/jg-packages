import type { ISchema } from '../shared/index.js';

// where the variables come from, such as process.env or Vite's import.meta.env. Only string values
// count as set, so a source may hold other values, such as import.meta.env's booleans
export type IEnvironmentSource = Readonly<Record<string, unknown>>;

// reads a source's variables, each time from its current values. A required read of an unset
// variable throws ENV_VARIABLE_MISSING, and a value that can't be used throws ENV_VARIABLE_INVALID,
// without a cause, so neither ever holds the value
export type IEnvironmentReader = {
  // reads a variable that must be set, as it is, without trimming
  readString: (key: string) => string;

  // reads a variable that must be one of the allowed values
  readEnum: <const T extends string>(key: string, values: readonly T[]) => T;

  // reads a variable that must be exactly true or false
  readBoolean: (key: string) => boolean;

  // reads a variable that must be an integer in plain decimal digits, such as 8080 or -2
  readInteger: (key: string) => number;

  // reads a variable that must be JSON its schema accepts
  readJson: <T>(key: string, schema: ISchema<T>) => T;

  // the same as readString, but undefined when the variable is unset
  readOptionalString: (key: string) => string | undefined;

  // the same as readBoolean, but undefined when the variable is unset
  readOptionalBoolean: (key: string) => boolean | undefined;

  // the same as readInteger, but undefined when the variable is unset
  readOptionalInteger: (key: string) => number | undefined;

  // the same as readJson, but undefined when the variable is unset
  readOptionalJson: <T>(key: string, schema: ISchema<T>) => T | undefined;
};
