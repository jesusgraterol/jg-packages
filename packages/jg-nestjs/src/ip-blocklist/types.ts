import type { IncomingMessage } from 'node:http';

// the request IpBlocklistGuard reads the client's address from, with Express's `ip`
export type IIpBlocklistRequest = IncomingMessage & { ip?: string | undefined };

// what IpBlocklistGuard takes, through IP_BLOCKLIST_GUARD_OPTIONS
export type IIpBlocklistGuardOptions = {
  // resolves to whether the normalized address is blocked, such as with jg-redis's blocklist. An
  // error it throws refuses the request, which the filter answers with a 500 and reports
  isBlocked: (ip: string) => boolean | Promise<boolean>;

  // reads the client's address from the request. Defaults to Express's `request.ip`, which
  // follows configureHttpApp's trustProxyHops
  getIp?: ((request: IIpBlocklistRequest) => string | undefined) | undefined;
};
