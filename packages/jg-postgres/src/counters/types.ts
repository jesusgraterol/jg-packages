// a counter table's layout: its name, the columns that identify a row, and the counter columns
export type ICounterTableDefinition<K extends string, C extends string> = {
  // the table's name, quoted in the SQL
  table: string;

  // the columns that identify a row, which a unique constraint must cover exactly
  keyColumns: readonly K[];

  // the BIGINT counter columns, each with a default, such as 0
  counters: readonly C[];
};

// a row's key: a value for every key column, none of them empty
export type ICounterKey<K extends string> = Record<K, string | number | bigint>;

// the whole amounts to add to some of the counters
export type ICounterChanges<C extends string> = Partial<Record<C, number | bigint>>;

// a query a counter table builds, with the key that orders it among a transaction's other queries
export type ICounterQuery = {
  // the SQL, with every value as a parameter
  text: string;

  // the parameters, with bigints as strings
  values: unknown[];

  // the table and the row's key, so queries for the same rows run in the same order everywhere
  lockKey: string;
};

// builds the queries that change a counter table's rows
export type ICounterTable<K extends string, C extends string> = {
  // inserts the row with the increments, or adds them to the row that exists
  buildIncrement: (key: ICounterKey<K>, increments: ICounterChanges<C>) => ICounterQuery;

  // adds the changes, which may be negative, to a row that must exist
  buildAdjustment: (key: ICounterKey<K>, changes: ICounterChanges<C>) => ICounterQuery;
};
