import type { PoolClient } from 'pg';

/**
 * Checks whether the public schema has a table.
 * @param client The transaction's client.
 * @param table The table's name.
 * @returns A promise that resolves to whether it does.
 */
export const hasPublicTable = async (client: PoolClient, table: string): Promise<boolean> =>
  Number(
    (
      await client.query(
        "SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = $1;",
        [table],
      )
    ).rowCount,
  ) > 0;

/**
 * Checks whether the public schema holds any relation, routine, or type, such as a table, an
 * index, a function, or one an extension created there.
 * @param client The transaction's client.
 * @returns A promise that resolves to whether it does.
 */
export const isPublicSchemaOccupied = async (client: PoolClient): Promise<boolean> =>
  Number(
    (
      await client.query(`SELECT 1
WHERE EXISTS (
  SELECT 1 FROM pg_catalog.pg_class
  WHERE relnamespace = 'public'::regnamespace
) OR EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc
  WHERE pronamespace = 'public'::regnamespace
) OR EXISTS (
  SELECT 1 FROM pg_catalog.pg_type
  WHERE typnamespace = 'public'::regnamespace
);`)
    ).rowCount,
  ) > 0;
