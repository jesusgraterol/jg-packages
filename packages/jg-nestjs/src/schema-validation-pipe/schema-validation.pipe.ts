import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
  StandardSchemaValidationPipe,
} from '@nestjs/common';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import type { IStandardSchemaIssue } from './types.js';
import { toValidationIssues } from './utilities.js';

/**
 * Validates each parameter that declares a Standard Schema, such as a Zod schema in
 * `@Body({ schema })`, and answers invalid input with a 400 ApiException: code VALIDATION_FAILED,
 * with up to 32 `{ path, message }` issues as its data. A valid parameter becomes the schema's
 * output, and keys such as `__proto__` are stripped before validation.
 * @example
 * import { Body, Controller, Module, Post } from '@nestjs/common';
 * import { APP_PIPE } from '@nestjs/core';
 * import { SchemaValidationPipe } from 'jg-nestjs';
 * import { z } from 'zod';
 *
 * const CreateProjectSchema = z.strictObject({ name: z.string().min(1).max(64) });
 *
 * @Controller('projects')
 * class ProjectsController {
 *   @Post()
 *   create(@Body({ schema: CreateProjectSchema }) body: z.infer<typeof CreateProjectSchema>) {
 *     return { name: body.name };
 *   }
 * }
 *
 * @Module({
 *   controllers: [ProjectsController],
 *   providers: [{ provide: APP_PIPE, useClass: SchemaValidationPipe }],
 * })
 * export class AppModule {}
 */
@Injectable()
export class SchemaValidationPipe implements PipeTransform {
  /*
   * Nest's pipe, wrapped instead of extended: without decorator metadata, a subclass inherits its
   * parent's constructor parameter but not the marker that makes it optional, so Nest couldn't
   * create it.
   */
  private readonly __pipe = new StandardSchemaValidationPipe({
    exceptionFactory: (issues: readonly IStandardSchemaIssue[]) =>
      new ApiException(ERROR_MESSAGES.VALIDATION_FAILED, {
        code: ERRORS.VALIDATION_FAILED,
        status: 400,
        data: { issues: toValidationIssues(issues) },
      }),
  });

  /**
   * Validates a parameter against the schema it declares, if any.
   * @param value The parameter's value.
   * @param metadata The parameter's metadata, with its schema.
   * @returns A promise that resolves to the schema's output, or to the value when the parameter
   * declares no schema.
   * @throws
   * - VALIDATION_FAILED: The request failed validation.
   */
  public transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return this.__pipe.transform(value, metadata);
  }
}
