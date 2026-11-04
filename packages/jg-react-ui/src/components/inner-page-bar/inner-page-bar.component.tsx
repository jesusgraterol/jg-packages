import type * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cnfast';
import { usePageReturn } from 'jg-react-router';

import { buttonVariants } from '../button/index.js';

import type { IInnerPageBarProps } from './types.js';

/**
 * Renders an inner page's own top bar, first in its PageShell, which stays at the top while the
 * page scrolls: Back, to the page it was reached from or its parent, the page's title, cut to
 * fit, and the page's actions at its end. On phones it takes the place of the app's header, below
 * the notch, and it bleeds to the page's edges below the lg breakpoint. Its height is
 * `--inner-page-bar-height`, 3.5rem unless the app sets it, plus the top safe-area inset, so the
 * app offsets its sticky elements and scroll padding by the same variable.
 * @param props The page's title, the app's page return, the parent page with its name, and the
 * page's actions.
 * @returns A React element that renders the bar.
 * @example
 * import { createElement } from 'react';
 * import { createPageReturn } from 'jg-react-router';
 * import { InnerPageBar } from 'jg-react-ui/components/inner-page-bar';
 * const pageReturn = createPageReturn({ resolveOrigin: () => null });
 * const example = createElement(InnerPageBar, {
 *   title: 'Session 42',
 *   pageReturn,
 *   parentHref: '/sessions',
 *   parentLabel: 'Sessions',
 * });
 */
export const InnerPageBar = ({
  title,
  pageReturn,
  parentHref,
  parentLabel,
  actions,
}: IInnerPageBarProps): React.ReactElement => {
  const { returnTo, returnState } = usePageReturn(pageReturn, { parentHref });
  const back = returnTo ?? { href: parentHref, label: parentLabel };
  return (
    <div
      data-slot="inner-page-bar"
      className="-mx-page-gutter bg-background/95 px-page-gutter sticky top-0 z-20 -mt-4 mb-4 flex min-h-[calc(var(--inner-page-bar-height,3.5rem)+env(safe-area-inset-top))] min-w-0 items-center gap-2 border-b pt-[env(safe-area-inset-top)] backdrop-blur sm:-mt-8 sm:mb-6 lg:mx-0 lg:px-0"
    >
      <Link
        aria-label={`Back to ${back.label}`}
        className={cn(
          buttonVariants({ size: 'icon-touch', variant: 'ghost' }),
          '-ms-2 rounded-full',
        )}
        state={returnState}
        to={back.href}
      >
        <ArrowLeft aria-hidden="true" />
      </Link>
      <p className="min-w-0 flex-1 truncate text-base font-semibold">{title}</p>
      {actions === undefined ? null : (
        <div className="-me-2 flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </div>
  );
};
