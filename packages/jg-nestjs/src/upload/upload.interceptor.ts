import type { IncomingMessage } from 'node:http';

import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  mixin,
  type NestInterceptor,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { finalize, type Observable } from 'rxjs';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import type { IUploadInterceptorOptions } from './types.js';
import { assertUploadOptions } from './validations.js';

/**
 * Builds the error an upload that failed while it was read answers with: UPLOAD_REJECTED with
 * multer's 413 or 400, or with 408 after the timeout and 400 after the client went away, which no
 * one receives but the logs show. Any other error passes through.
 * @param error What reading the upload failed with.
 * @param hasTimedOut Whether the upload timeout closed the connection.
 * @param request The request, whose `destroyed` tells whether the connection is gone.
 * @returns The error to throw.
 */
const toUploadError = (error: unknown, hasTimedOut: boolean, request: IncomingMessage): unknown => {
  const status = hasTimedOut
    ? 408
    : error instanceof PayloadTooLargeException
      ? 413
      : error instanceof BadRequestException || request.destroyed
        ? 400
        : undefined;
  return status === undefined
    ? error
    : new ApiException(ERROR_MESSAGES.UPLOAD_REJECTED, {
        code: ERRORS.UPLOAD_REJECTED,
        status,
        cause: error,
      });
};

/**
 * Creates an interceptor that receives one file from a multipart request into memory, as Nest's
 * `FileInterceptor` does with `@UploadedFile()`, under limits: the file holds at most `maxBytes`,
 * no other part is accepted, at most `maxConcurrent` requests hold a slot at once, and an upload
 * that takes longer than `uploadTimeoutSeconds` has its connection closed. A slot is taken before
 * the upload starts and given back when the handler ends or the upload fails.
 *
 * Each call creates a class with its own slots, shared by every instance Nest makes of it, so call
 * it once at module scope and use the class wherever those slots apply. A request beyond the slots
 * gets a 503 with UPLOAD_CAPACITY_FULL, which is reported. A file over the limit gets a 413 and a
 * malformed request a 400, with UPLOAD_REJECTED, which isn't. Options that aren't positive
 * integers, or a timeout of 0 or more than MAX_UPLOAD_TIMEOUT_SECONDS, throw at once, so a limit
 * read from a missing variable never turns into no limit.
 * @param options The file's field, its byte limit, the slots, and the upload timeout.
 * @returns The interceptor's class.
 * @example
 * import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
 * import { createUploadInterceptor } from 'jg-nestjs';
 *
 * const AudioUpload = createUploadInterceptor({
 *   field: 'audio',
 *   maxBytes: 25_000_000,
 *   maxConcurrent: 2,
 *   uploadTimeoutSeconds: 120,
 * });
 *
 * @Controller('transcriptions')
 * export class TranscriptionsController {
 *   @Post()
 *   @UseInterceptors(AudioUpload)
 *   public create(@UploadedFile() file: { buffer: Buffer; mimetype: string }): number {
 *     return file.buffer.byteLength;
 *   }
 * }
 * @throws
 * - INVALID_UPLOAD_OPTIONS: The upload options are invalid.
 */
export const createUploadInterceptor = (
  options: IUploadInterceptorOptions,
): Type<NestInterceptor> => {
  assertUploadOptions(options);
  const { field, maxBytes, maxConcurrent, uploadTimeoutSeconds } = options;
  // multer's file size limit refuses a file that reaches it, so one byte more admits maxBytes
  const FileUpload = FileInterceptor(field, {
    limits: { fileSize: maxBytes + 1, files: 1, fields: 0 },
  });
  let activeUploads = 0;

  @Injectable()
  class UploadInterceptor implements NestInterceptor {
    private readonly __fileUpload: NestInterceptor = new FileUpload();

    public async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      if (activeUploads >= maxConcurrent) {
        throw new ApiException(ERROR_MESSAGES.UPLOAD_CAPACITY_FULL, {
          code: ERRORS.UPLOAD_CAPACITY_FULL,
          status: 503,
        });
      }
      activeUploads += 1;
      let isReleased = false;
      const release = (): void => {
        if (!isReleased) {
          isReleased = true;
          activeUploads -= 1;
        }
      };

      const request = context.switchToHttp().getRequest<IncomingMessage>();
      let hasTimedOut = false;
      const timer = setTimeout(() => {
        hasTimedOut = true;
        request.socket.destroy();
        release();
      }, uploadTimeoutSeconds * 1000);
      try {
        const handled = await this.__fileUpload.intercept(context, next);
        return (handled as Observable<unknown>).pipe(finalize(release));
      } catch (error) {
        release();
        throw toUploadError(error, hasTimedOut, request);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return mixin(UploadInterceptor);
};
