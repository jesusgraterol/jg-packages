import type { ITimeoutProfile } from '../timeouts/index.js';

// what initializeSchemaOnce takes
export type IInitializeSchemaOptions = {
  // the statements that create the schema, run in order in one transaction, so none may be one
  // that can't run in a transaction, such as CREATE INDEX CONCURRENTLY
  statements: readonly string[];

  // a table in the public schema the statements create, whose presence marks the schema as
  // initialized, such as `schema_migration`
  markerTable: string;

  // the statement and lock timeouts of the transaction
  timeouts?: ITimeoutProfile | undefined;
};
