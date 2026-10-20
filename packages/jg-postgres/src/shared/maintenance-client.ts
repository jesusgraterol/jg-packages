import { Client } from 'pg';

import type { IPostgresConfig } from '../postgres/index.js';

// the database every PostgreSQL server has, which statements on other databases connect to
const MAINTENANCE_DATABASE = 'postgres';

/**
 * Runs an operation on one connection to the server's maintenance database, `postgres`, with the
 * rest of a database's configuration, for statements that can't run on the database they change,
 * such as CREATE DATABASE. The connection is closed afterwards, and its errors outside any query go
 * to onError.
 * @param config The configuration of the database the operation is about.
 * @param operation The work, given the connection.
 * @returns A promise that resolves to what the operation resolves to.
 */
export const withMaintenanceClient = async <T>(
  { onError, ...config }: IPostgresConfig,
  operation: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = new Client({ ...config, database: MAINTENANCE_DATABASE });
  client.on('error', onError ?? ((error: unknown): void => console.error(error)));
  try {
    await client.connect();
    return await operation(client);
  } finally {
    await client.end();
  }
};
