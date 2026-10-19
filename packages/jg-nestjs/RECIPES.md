# jg-nestjs recipes

Wiring the envelope, validation, and error reporting into a NestJS API, and sending its failures to an error tracker.

## Wiring the filter, interceptor, and pipe

An app module that answers every request in the envelope, validates bodies with Zod, and keeps a token out of the URLs it logs.

```ts
import { Body, Controller, Module, Post } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  API_EXCEPTION_FILTER_OPTIONS,
  ApiException,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  type IApiExceptionFilterOptions,
  SchemaValidationPipe,
} from 'jg-nestjs';
import { z } from 'zod';

// the app's own data access
declare const projects: {
  findByName: (name: string) => Promise<{ id: number } | undefined>;
  create: (name: string) => Promise<{ id: number; name: string }>;
};

const CreateProjectSchema = z.strictObject({ name: z.string().trim().min(1).max(64) });

@Controller('projects')
class ProjectsController {
  @Post()
  async create(@Body({ schema: CreateProjectSchema }) body: z.infer<typeof CreateProjectSchema>) {
    if ((await projects.findByName(body.name)) !== undefined) {
      throw new ApiException('A project with that name exists.', {
        code: 'PROJECT_NAME_TAKEN',
        status: 409,
        severity: 'expected',
      });
    }
    return projects.create(body.name);
  }
}

const filterOptions: IApiExceptionFilterOptions = {
  redactUrl: (url) => url.replace(/([?&]token=)[^&]*/, '$1[redacted]'),
};

@Module({
  controllers: [ProjectsController],
  providers: [
    { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: filterOptions },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_PIPE, useClass: SchemaValidationPipe },
  ],
})
export class AppModule {}
```

A taken name answers 409 with `PROJECT_NAME_TAKEN`, and an empty one 400 with `VALIDATION_FAILED` and the issue at `['name']`. Marking the conflict `expected` keeps it out of the reports, because it's the client's mistake, not the API's.

## Reporting errors to an error tracker

The filter hands each reportable error to `report` without waiting for it, so a slow or failing tracker never delays or changes the response. The tracker client here stands in for the one the app uses.

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter, type IErrorReport } from 'jg-nestjs';

// the app's error tracker client
declare const tracker: {
  capture: (error: unknown, context: Record<string, string | number>) => Promise<void>;
};

const report = async ({ error, status, severity, request, url }: IErrorReport): Promise<void> => {
  await tracker.capture(error, {
    level: severity === 'critical' ? 'fatal' : 'error',
    method: request.method ?? 'UNKNOWN',
    url,
    status,
  });
};

@Module({
  providers: [
    {
      provide: API_EXCEPTION_FILTER_OPTIONS,
      useValue: { report, ignoredStatuses: [401, 404, 429] },
    },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
```

Adding 404 to `ignoredStatuses` keeps requests for routes that don't exist, which crawlers send all day, out of the tracker. The URL is already redacted when `redactUrl` is set, and a tracker that throws is logged instead.
