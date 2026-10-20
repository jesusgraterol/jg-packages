import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { expectToThrowCode } from 'jg-exception/testing';
import { lastValueFrom, type Observable, of } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import type { IUploadInterceptorOptions } from './types.js';
import { createUploadInterceptor } from './upload.interceptor.js';

// what the file upload underneath fails with, which the next test sets
let uploadFailure: Error | undefined;

// stands in for Nest's file upload, to make it fail in ways a real request can't
vi.mock('@nestjs/platform-express', () => ({
  FileInterceptor: () =>
    class {
      public intercept(_context: ExecutionContext, next: CallHandler): unknown {
        if (uploadFailure !== undefined) {
          return Promise.reject(uploadFailure);
        }
        return Promise.resolve(next.handle());
      }
    },
}));

/**
 * Creates the interceptor with valid options, changed by an override.
 * @param override The options to change.
 * @returns The interceptor's class.
 */
const createWith = (override: Partial<IUploadInterceptorOptions> = {}) =>
  createUploadInterceptor({
    field: 'file',
    maxBytes: 8,
    maxConcurrent: 1,
    uploadTimeoutSeconds: 30,
    ...override,
  });

const context = {
  switchToHttp: () => ({ getRequest: () => ({ destroyed: false, socket: { destroy: vi.fn() } }) }),
} as unknown as ExecutionContext;

describe('createUploadInterceptor', () => {
  test("passes on an error that isn't the upload's fault, and frees the slot", async () => {
    const interceptor = new (createWith())();
    const failure = new Error('The disk is full.');
    uploadFailure = failure;

    await expect(interceptor.intercept(context, { handle: () => of('done') })).rejects.toBe(
      failure,
    );

    uploadFailure = undefined;
    const handled = await interceptor.intercept(context, { handle: () => of('done') });
    await expect(lastValueFrom(handled as Observable<string>)).resolves.toBe('done');
  });

  test.each([
    ['field', { field: '' }],
    ['maxBytes', { maxBytes: Number.NaN }],
    ['maxBytes', { maxBytes: 0 }],
    ['maxConcurrent', { maxConcurrent: 1.5 }],
    ['uploadTimeoutSeconds', { uploadTimeoutSeconds: 0 }],
    ['uploadTimeoutSeconds', { uploadTimeoutSeconds: Number.POSITIVE_INFINITY }],
    ['uploadTimeoutSeconds', { uploadTimeoutSeconds: 2_147_484 }],
  ])('refuses an invalid %s with INVALID_UPLOAD_OPTIONS', (option, override) => {
    expectToThrowCode(
      () => createWith(override),
      ERRORS.INVALID_UPLOAD_OPTIONS,
      'The upload options are invalid.',
    );
    expect(() => createWith(override)).toThrow(expect.objectContaining({ data: { option } }));
  });

  test('accepts the longest timeout a timer can wait', () => {
    expect(() => createWith({ uploadTimeoutSeconds: 2_147_483 })).not.toThrow();
  });
});
