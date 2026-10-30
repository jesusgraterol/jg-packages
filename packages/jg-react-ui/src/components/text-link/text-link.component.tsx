import { cloneElement, isValidElement } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';
import { ExternalLink } from 'lucide-react';

import { useSlottedRender } from '../../shared/slotted-render/index.js';
import { TEXT_LINK_VARIANT_CLASS_NAMES } from './constants.js';
import type { ITextLinkProps } from './types.js';

/**
 * Renders a prose or standalone action link with shared interaction states.
 * @param props The anchor props, visual variant, and optional slot rendering flag.
 * @returns A React element that renders the text link.
 * @example
 * import { createElement } from 'react';
 * import { TextLink } from 'jg-react-ui/components/text-link';
 * const example = createElement(TextLink, { href: '/settings', children: 'Settings' });
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const TextLink = ({
  className,
  asChild = false,
  variant = 'prose',
  ...props
}: ITextLinkProps): React.ReactElement => {
  const child =
    asChild && isValidElement<React.ComponentPropsWithRef<'a'>>(props.children)
      ? props.children
      : null;
  const opensInNewTab = (child?.props.target ?? props.target) === '_blank';
  const label = child?.props['aria-label'] ?? props['aria-label'];
  const children = opensInNewTab ? (
    <>
      {child ? child.props.children : props.children}
      <span
        data-slot="new-tab-indicator"
        className="ml-1 inline-flex align-middle"
      >
        <ExternalLink
          aria-hidden="true"
          className="size-[0.8em] shrink-0"
        />
        <span className="sr-only"> (opens in a new tab)</span>
      </span>
    </>
  ) : (
    props.children
  );
  const rel = child?.props.rel ?? props.rel;
  const newTabLabel = label ? `${label} (opens in a new tab)` : undefined;
  const secureRel = [
    ...new Set([...(rel?.split(/\s+/).filter(Boolean) ?? []), 'noopener', 'noreferrer']),
  ].join(' ');
  const linkProps = opensInNewTab
    ? {
        ...props,
        'aria-label': newTabLabel,
        rel: secureRel,
        children: child
          ? cloneElement(child, { children, rel: secureRel, 'aria-label': newTabLabel })
          : children,
      }
    : props;

  return useSlottedRender<'a', HTMLAnchorElement>({
    asChild,
    defaultTagName: 'a',
    baseProps: {
      'data-slot': 'text-link',
      'data-variant': variant,
      className: cn(
        'rounded-sm wrap-break-word outline-none hover:opacity-70 active:opacity-60 focus-visible:ring-2 focus-visible:ring-current',
        TEXT_LINK_VARIANT_CLASS_NAMES[variant],
        className,
      ),
    } as React.ComponentPropsWithRef<'a'>,
    elementProps: linkProps,
  });
};
