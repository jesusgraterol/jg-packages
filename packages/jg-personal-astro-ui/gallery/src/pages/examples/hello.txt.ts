import type { APIRoute } from 'astro';

import source from '../../examples/hello.txt?raw';

/**
 * Serves the authored source fixture for raw and download recipe actions.
 * @returns The plain-text source response.
 */
export const GET: APIRoute = () =>
  new Response(source, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
