import { request as httpRequest } from 'node:http';

import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  API_EXCEPTION_FILTER_OPTIONS,
  ApiExceptionFilter,
  type IErrorReport,
} from '../exception-filter/index.js';
import { ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { createUploadInterceptor } from './upload.interceptor.js';

// one slot and a short timeout, for the limits
const SmallUpload = createUploadInterceptor({
  field: 'file',
  maxBytes: 8,
  maxConcurrent: 1,
  uploadTimeoutSeconds: 0.25,
});

// separate slots, for uploads that are left hanging
const HangingUpload = createUploadInterceptor({
  field: 'file',
  maxBytes: 8,
  maxConcurrent: 1,
  uploadTimeoutSeconds: 30,
});

// holds the small upload's handler until a test lets it finish
let gate: Promise<void> = Promise.resolve();

@Controller('uploads')
class UploadsController {
  @Post('small')
  @UseInterceptors(SmallUpload)
  public async small(@UploadedFile() file: { size: number }): Promise<{ size: number }> {
    await gate;
    return { size: file.size };
  }

  @Post('hanging')
  @UseInterceptors(HangingUpload)
  public hanging(@UploadedFile() file: { size: number }): { size: number } {
    return { size: file.size };
  }
}

const report = vi.fn<(errorReport: IErrorReport) => void>();
let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp({
    controllers: [UploadsController],
    providers: [
      { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  });
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  gate = Promise.resolve();
  report.mockClear();
});

/**
 * Builds a multipart body with one file of a number of bytes, and other parts.
 * @param bytes The file's size.
 * @param options The file's field, and extra text fields.
 * @returns The form.
 */
const formWith = (
  bytes: number,
  { field = 'file', extra = {} }: { field?: string; extra?: Record<string, string> } = {},
): FormData => {
  const form = new FormData();
  for (const [name, value] of Object.entries(extra)) {
    form.append(name, value);
  }
  form.append(field, new Blob([new Uint8Array(bytes)]), 'audio.webm');
  return form;
};

/**
 * Uploads a form to a route.
 * @param route The route, under /uploads.
 * @param form The form.
 * @returns A promise that resolves to the status and the parsed body.
 */
const upload = (route: string, form: FormData) =>
  requestJson(`${server.baseUrl}/uploads/${route}`, { method: 'POST', body: form });

/**
 * Starts an upload that sends its headers and part of its body, then nothing more.
 * @param route The route, under /uploads.
 * @returns The request, and a promise that settles when its connection ends.
 */
const startHangingUpload = (route: string) => {
  const boundary = 'jg-nestjs-boundary';
  const { hostname, port } = new URL(server.baseUrl);
  const request = httpRequest({
    hostname,
    port,
    method: 'POST',
    path: `/uploads/${route}`,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
  const ended = new Promise<string>((resolve) => {
    request.on('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? error.message));
    request.on('response', (response) => resolve(`status ${response.statusCode}`));
  });
  request.write(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="a.webm"\r\n\r\nabc`,
  );
  return { request, ended };
};

describe('createUploadInterceptor', () => {
  test('accepts a file of exactly maxBytes', async () => {
    const response = await upload('small', formWith(8));

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({ size: 8 });
  });

  test('refuses a file one byte over the limit with a 413, unreported', async () => {
    const response = await upload('small', formWith(9));

    expect(response).toMatchObject({
      status: 413,
      body: { error: { code: ERRORS.UPLOAD_REJECTED, message: 'The upload was rejected.' } },
    });
    expect(report).not.toHaveBeenCalled();
  });

  test.each([
    ['another field', formWith(4, { extra: { note: 'hello' } })],
    ['the file under another name', formWith(4, { field: 'audio' })],
  ])('refuses %s with a 400, unreported', async (_, form) => {
    const response = await upload('small', form);

    expect(response).toMatchObject({
      status: 400,
      body: { error: { code: ERRORS.UPLOAD_REJECTED } },
    });
    expect(report).not.toHaveBeenCalled();
  });

  test('refuses a request beyond the slots with a 503, reported, until the slot is given back', async () => {
    let open = (): void => undefined;
    gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const first = upload('small', formWith(4));
    await vi.waitFor(async () => {
      const busy = await upload('small', formWith(4));
      expect(busy).toMatchObject({
        status: 503,
        body: {
          error: {
            code: ERRORS.UPLOAD_CAPACITY_FULL,
            message: 'Uploads are at capacity. Try again shortly.',
          },
        },
      });
    });
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));

    // another interceptor's slots are its own
    expect((await upload('hanging', formWith(4))).status).toBe(201);

    open();
    expect((await first).status).toBe(201);
    expect((await upload('small', formWith(4))).status).toBe(201);
  });

  test('closes the connection of an upload that runs past the timeout, and frees its slot', async () => {
    const { ended } = startHangingUpload('small');

    expect(await ended).toBe('ECONNRESET');
    expect((await upload('small', formWith(4))).status).toBe(201);
    expect(report).not.toHaveBeenCalled();
  });

  test('frees the slot of an upload the client abandons', async () => {
    const { request } = startHangingUpload('hanging');
    await vi.waitFor(async () => {
      expect((await upload('hanging', formWith(4))).status).toBe(503);
    });

    request.destroy();

    await vi.waitFor(async () => {
      expect((await upload('hanging', formWith(4))).status).toBe(201);
    });
  });
});
