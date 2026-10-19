// which schema readDatabaseSummary and listTableSizes read the tables of
export type IIntrospectionOptions = {
  // the schema. Defaults to 'public'
  schema?: string | undefined;
};

// the database a connection is on: its name, server, size, connections, and tables
export type IDatabaseSummary = {
  // the database's name
  name: string;

  // the server's version, such as '18.1'
  serverVersion: string;

  // the server's version as a number, such as 180001, to compare versions
  serverVersionNumber: number;

  // the database's size on disk, in bytes
  sizeBytes: number;

  // the connections to this database running a query now. Without pg_read_all_stats, only the
  // role's own connections are counted
  activeConnections: number;

  // the most connections the server accepts, over every database
  maxConnections: number;

  // the ordinary tables in the schema
  tableCount: number;
};

// a table and its size on disk, with its indexes and TOAST data
export type ITableSize = {
  // the table's name
  name: string;

  // its total size, in bytes
  totalBytes: number;
};

// how a schema's tables differ from the ones expected
export type ITableDiff = {
  // the expected tables that don't exist
  missing: string[];

  // the tables that exist but aren't expected
  unexpected: string[];
};

// the row the summary query returns, with BIGINT counts and sizes as strings
export type IDatabaseSummaryRow = {
  name: string;
  server_version: string;
  server_version_number: number;
  size_bytes: string;
  active_connections: string;
  max_connections: number;
  table_count: string;
};
