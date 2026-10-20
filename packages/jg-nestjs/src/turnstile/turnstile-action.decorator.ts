import { Reflector } from '@nestjs/core';

/**
 * Sets the action a route's Turnstile widget must have been rendered with, such as `'contact'`, so
 * a token solved for another form, such as sign-up, is refused there. On a controller, it applies
 * to every route, and a route's own overrides it.
 * @example
 * import { Body, Controller, Post, UseGuards } from '@nestjs/common';
 * import { TurnstileAction, TurnstileGuard } from 'jg-nestjs/turnstile';
 *
 * @Controller('contact')
 * export class ContactController {
 *   @Post()
 *   @UseGuards(TurnstileGuard)
 *   @TurnstileAction('contact')
 *   public send(@Body() message: unknown): unknown {
 *     return message;
 *   }
 * }
 */
export const TurnstileAction = Reflector.createDecorator<string>();
