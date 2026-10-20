// @vitest-environment node
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import * as rootEntry from '../index.js';
import { ERRORS } from '../shared/index.js';
import { createTestDatabaseName, dropTestDatabase } from './testing.js';

describe('createTestDatabaseName', () => {
  test("prefixes the name with this process's id", () => {
    expect(createTestDatabaseName('primary')).toBe(`test_${String(process.pid)}_primary`);
  });

  test.each([[''], ['Primary'], ['with-dash'], ['with space'], ['ü'], ['x'.repeat(60)], [42]])(
    'refuses %j with INVALID_TEST_DATABASE_NAME',
    (name) => {
      expectToThrowCode(
        () => createTestDatabaseName(name as string),
        ERRORS.INVALID_TEST_DATABASE_NAME,
        'The test database name must hold only lowercase letters',
      );
    },
  );
});

describe('dropTestDatabase', () => {
  test.each([
    ['the maintenance database', 'postgres'],
    ['an app database', 'app'],
    ["another process's test database", `test_${String(process.pid + 1)}_primary`],
    ['the bare prefix', `test_${String(process.pid)}_`],
    ['a name with a quote', `test_${String(process.pid)}_a"b`],
    ['no name', undefined],
  ])('refuses %s with INVALID_TEST_DATABASE_NAME before connecting', async (_, database) => {
    await expectToRejectCode(
      dropTestDatabase({ host: '127.0.0.1', port: 1, database }),
      ERRORS.INVALID_TEST_DATABASE_NAME,
    );
  });
});

describe('the root entry', () => {
  test("doesn't export the testing helpers", () => {
    expect(rootEntry).not.toHaveProperty('createTestDatabaseName');
    expect(rootEntry).not.toHaveProperty('dropTestDatabase');
  });
});
