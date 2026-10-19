import { Body, Controller, Logger, Post } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { ApiExceptionFilter } from '../exception-filter/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { SchemaValidationPipe } from './schema-validation.pipe.js';

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()).max(4).default([]),
});

@Controller('projects')
class ProjectsController {
  @Post()
  public create(@Body({ schema: CreateProjectSchema }) body: z.infer<typeof CreateProjectSchema>) {
    return {
      body,
      keys: Object.keys(body),
      hasPolluted: Object.prototype.hasOwnProperty.call(Object.prototype, 'isAdmin'),
    };
  }
}

let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp({
    controllers: [ProjectsController],
    providers: [
      { provide: APP_PIPE, useClass: SchemaValidationPipe },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  });
});

afterAll(async () => {
  await server.close();
});

/**
 * Posts a raw JSON body to the projects route.
 * @param json The body, as written.
 * @returns A promise that resolves to the response.
 */
const postProject = (json: string) =>
  requestJson(`${server.baseUrl}/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: json,
  });

describe('SchemaValidationPipe in an app', () => {
  test("gives the handler the schema's output, without a __proto__ key", async () => {
    const { status, body } = await postProject('{"name":"acme","__proto__":{"isAdmin":true}}');

    expect(status).toBe(201);
    expect(body).toStrictEqual({
      body: { name: 'acme', tags: [] },
      keys: ['name', 'tags'],
      hasPolluted: false,
    });
  });

  test('answers invalid input with a 400 VALIDATION_FAILED and its issues', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { status, body } = await postProject('{"name":"","tags":["a",2]}');

    expect(status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: ERRORS.VALIDATION_FAILED,
        message: ERROR_MESSAGES.VALIDATION_FAILED,
        data: {
          issues: [
            { path: ['name'], message: expect.any(String) as unknown },
            { path: ['tags', 1], message: expect.any(String) as unknown },
          ],
        },
      },
    });
  });
});
