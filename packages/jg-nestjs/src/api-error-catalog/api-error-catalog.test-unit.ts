// @vitest-environment node
import { Exception } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { defineApiErrorCatalog } from './api-error-catalog.js';

const catalog = defineApiErrorCatalog({
  notFound: {
    code: 'PROJECT_NOT_FOUND',
    message: 'The project was not found.',
    status: 404,
    severity: 'expected',
  },
  unavailable: { code: 'PROJECTS_UNAVAILABLE', message: 'Projects are unavailable.', status: 503 },
});

describe('defineApiErrorCatalog', () => {
  test("creates the kind's ApiException, with its code, message, status, and severity", () => {
    const error = catalog.create('notFound');

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404, severity: 'expected' });
    expect(error.message).toBe('The project was not found.');
    expect(error.data).toBeUndefined();
    expect(Object.hasOwn(catalog.create('unavailable'), 'severity')).toBe(false);
    expect(catalog.create('unavailable').status).toBe(503);
  });

  test('keeps the cause and the data it is given', () => {
    const cause = new Error('connection refused');

    const error = catalog.create('unavailable', { cause, data: { region: 'eu' } });

    expect(error.cause).toBe(cause);
    expect(error.data).toStrictEqual({ region: 'eu' });
  });

  test('recognizes its errors by kind, or any of them without a kind, and nothing else', () => {
    const notFound = catalog.create('notFound');

    expect(catalog.is(notFound, 'notFound')).toBe(true);
    expect(catalog.is(notFound, 'unavailable')).toBe(false);
    expect(catalog.is(notFound)).toBe(true);
    expect(catalog.is(new Exception('Not found.', { code: 'PROJECT_NOT_FOUND' }), 'notFound')).toBe(
      true,
    );
    expect(catalog.is(new ApiException('Other.', { code: 'OTHER', status: 400 }))).toBe(false);
    expect(catalog.is(new Error('PROJECT_NOT_FOUND'))).toBe(false);
  });
});
