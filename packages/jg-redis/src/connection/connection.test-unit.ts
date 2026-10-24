import { expectToRejectCode } from 'jg-exception/testing';
import { expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { connectRedis } from './connection.js';

// a refused timeout never reaches node-redis
const createClient = vi.hoisted(() => vi.fn());
vi.mock('redis', () => ({ createClient }));

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
  'connectRedis(connectTimeout %s) -> INVALID_CONNECT_TIMEOUT',
  async (connectTimeout) => {
    await expectToRejectCode(
      connectRedis({ socket: { connectTimeout } }),
      ERRORS.INVALID_CONNECT_TIMEOUT,
      'The connect timeout must be a whole number of milliseconds, from 1 to 2,147,483,647.',
    );
    expect(createClient).not.toHaveBeenCalled();
  },
);
