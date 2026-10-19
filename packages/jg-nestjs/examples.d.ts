// what the recipes use but don't define; release check 8 typechecks them with it, and it never
// ships

// helmet, which an app installs for its security headers
declare module 'helmet' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export default function helmet(): (
    request: IncomingMessage,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ) => void;
}

// the part of Express the recipes use; Express 5 ships no types of its own
declare module 'express' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export function raw(options?: {
    type?: string;
    limit?: string | number;
  }): (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;
}
