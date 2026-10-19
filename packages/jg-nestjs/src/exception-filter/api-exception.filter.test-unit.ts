import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { API_EXCEPTION_FILTER_OPTIONS } from './constants.js';
import type { IApiExceptionFilterOptions } from './types.js';

// what the filter calls on the HTTP adapter
const httpAdapter = {
  isHeadersSent: vi.fn(() => false),
  reply: vi.fn<(response: unknown, body: unknown, status: number) => void>(),
};

// the request and response a fake HTTP host hands the filter
const request = { method: 'GET', url: '/fallback', originalUrl: '/projects?token=secret' };
const response = {};

let module: TestingModule | undefined;

afterEach(async () => {
  await module?.close();
  module = undefined;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

/**
 * Compiles a module with the filter, a fake HTTP adapter, and, when given, its options.
 * @param options The filter's options.
 * @returns A promise that resolves to the filter.
 */
const createFilter = async (options?: IApiExceptionFilterOptions): Promise<ApiExceptionFilter> => {
  module = await Test.createTestingModule({
    providers: [
      ApiExceptionFilter,
      { provide: HttpAdapterHost, useValue: { httpAdapter } },
      ...(options === undefined
        ? []
        : [{ provide: API_EXCEPTION_FILTER_OPTIONS, useValue: options }]),
    ],
  }).compile();
  await module.init();
  return module.get(ApiExceptionFilter);
};

/**
 * Builds a host of the given type, whose HTTP context holds the fake request and response.
 * @param type The context's type.
 * @returns The host.
 */
const createHost = (type: string): ArgumentsHost =>
  ({
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  }) as unknown as ArgumentsHost;

describe('ApiExceptionFilter', () => {
  test('rethrows an error outside HTTP, without answering it', async () => {
    const filter = await createFilter();
    const error = new Error('The queue job failed.');

    expect(() => {
      filter.catch(error, createHost('rpc'));
    }).toThrow(error);
    expect(httpAdapter.reply).not.toHaveBeenCalled();
  });

  test('answers through the adapter with the redacted URL in its log', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const filter = await createFilter({ redactUrl: (url) => url.replace('secret', '[redacted]') });
    const failure = new TypeError('x is undefined');

    filter.catch(failure, createHost('http'));

    expect(error).toHaveBeenCalledWith(failure, {
      method: 'GET',
      url: '/projects?token=[redacted]',
      status: 500,
    });
    expect(httpAdapter.reply.mock.calls).toStrictEqual([
      [
        response,
        {
          success: false,
          data: undefined,
          error: {
            code: ERRORS.INTERNAL_ERROR,
            message: ERROR_MESSAGES.INTERNAL_ERROR,
            data: null,
          },
        },
        500,
      ],
    ]);
  });

  test('logs, and leaves alone, a response that had already started', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    httpAdapter.isHeadersSent.mockReturnValueOnce(true);
    const filter = await createFilter();

    filter.catch(new Error('The stream broke.'), createHost('http'));

    expect(httpAdapter.reply).not.toHaveBeenCalled();
    expect(error).toHaveBeenLastCalledWith(
      "The response had already started, so the error wasn't answered.",
      { method: 'GET', url: '/projects?token=secret', status: 500 },
    );
  });

  test.each([
    ['the request URL when there is no originalUrl', { url: '/fallback' }, '/fallback'],
    ['an empty URL when the request has none', {}, ''],
  ])('reports %s', async (_, urls, expectedUrl) => {
    const report = vi.fn();
    const filter = await createFilter({ report });
    const original = { url: request.url, originalUrl: request.originalUrl };
    Reflect.deleteProperty(request, 'url');
    Reflect.deleteProperty(request, 'originalUrl');
    Object.assign(request, urls);
    try {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(new Error('Failed.'), createHost('http'));
    } finally {
      Object.assign(request, original);
    }

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ url: expectedUrl }));
  });

  test.each([
    [
      'throws',
      (): never => {
        throw new Error('The tracker is down.');
      },
    ],
    ['rejects', (): Promise<never> => Promise.reject(new Error('The tracker is down.'))],
  ])('logs a reporter that %s, and still answers', async (_, report) => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const filter = await createFilter({ report });

    filter.catch(new Error('Failed.'), createHost('http'));

    expect(httpAdapter.reply).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        'The error reporter failed.',
        expect.objectContaining({ message: 'The tracker is down.' }),
        { method: 'GET', url: '/projects?token=secret', status: 500 },
      );
    });
  });
});
