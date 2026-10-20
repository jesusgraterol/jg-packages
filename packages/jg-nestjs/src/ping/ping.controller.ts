import { Controller, Get, HttpCode, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'ping', version: VERSION_NEUTRAL })
export class PingController {
  /**
   * Answers that the API is up, with a 204 and no body, whatever version the request asks for.
   */
  @Get()
  @HttpCode(204)
  public ping(): void {
    // the empty answer is the whole response
  }
}
