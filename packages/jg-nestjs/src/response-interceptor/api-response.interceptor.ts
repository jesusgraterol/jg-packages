import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { buildResponse } from 'jg-api-response';
import { map, type Observable } from 'rxjs';

/**
 * Wraps what each HTTP handler returns in the jg-api-response envelope, `{ success: true, data,
 * error: null }`, which ApiExceptionFilter's error envelope matches. Other contexts, such as
 * microservices, pass through untouched. A handler that answers 204 sends no body, envelope
 * included.
 * @example
 * import { Module } from '@nestjs/common';
 * import { APP_INTERCEPTOR } from '@nestjs/core';
 * import { ApiResponseInterceptor } from 'jg-nestjs';
 *
 * @Module({
 *   providers: [{ provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor }],
 * })
 * export class AppModule {}
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  /**
   * Wraps an HTTP handler's result in the envelope.
   * @param context The request's context.
   * @param next The handler.
   * @returns The handler's result, wrapped when the request is HTTP.
   */
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    return next.handle().pipe(map((data: unknown) => buildResponse(data)));
  }
}
