import { randomUUID } from 'node:crypto';

import { inject } from 'vitest';

import { createPostgres } from '../postgres/index.js';
import type { IPostgres, IPostgresConfig } from '../postgres/index.js';

/**
 * Connects to the test container's database.
 * @param config More pool configuration, such as onError.
 * @returns The database.
 */
export const connectTestPostgres = (config: Partial<IPostgresConfig> = {}): IPostgres =>
  createPostgres({ ...inject('postgres'), max: 4, ...config });

/**
 * Creates a table name no other test uses, so test files can run at the same time.
 * @param prefix What the table is for, such as `sorting`.
 * @returns The name, such as `sorting_1a2b3c4d`.
 */
export const createTableName = (prefix: string): string =>
  `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
