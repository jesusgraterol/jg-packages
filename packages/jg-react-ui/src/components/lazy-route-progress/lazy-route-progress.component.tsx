import { type ReactElement } from 'react';

import { Progress } from '../progress/index.js';

/**
 * Renders the fixed top indicator shown while a lazy route chunk is loading.
 * @returns A React element that renders an indeterminate progress bar outside document flow.
 * @example
 * import { createElement } from 'react';
 * import { LazyRouteProgress } from 'jg-react-ui/components/lazy-route-progress';
 * const example = createElement(LazyRouteProgress);
 */
export const LazyRouteProgress = (): ReactElement => (
  <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50">
    <Progress
      indeterminate
      aria-label="Loading route"
      aria-valuetext="Route content is loading"
      className="h-1 rounded-none"
    />
  </div>
);
