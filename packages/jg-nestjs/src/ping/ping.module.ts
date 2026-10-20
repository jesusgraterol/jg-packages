import { Module } from '@nestjs/common';

import { PingController } from './ping.controller.js';

/**
 * Adds `GET /ping`, which answers 204 with no body whatever version the request asks for, for a load
 * balancer's or an uptime monitor's check. It runs the app's global guards like any route, so a
 * check that must pass during maintenance needs the route exempted.
 * @example
 * import { Module } from '@nestjs/common';
 * import { PingModule } from 'jg-nestjs';
 *
 * @Module({ imports: [PingModule] })
 * export class AppModule {}
 */
@Module({ controllers: [PingController] })
export class PingModule {}
