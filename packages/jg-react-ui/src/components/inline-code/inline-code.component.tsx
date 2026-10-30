import { Fragment } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';

import type { IInlineCodeProps } from './types.js';
import { splitCodeSegments } from './utilities.js';

/**
 * Renders inline code with preferred breaks after `/`, `_`, `.` or `-`.
 * Unbroken tokens can wrap when needed to fit the available width.
 * @param props The code element props.
 * @returns A React element that renders the inline code.
 * @example
 * import { createElement } from 'react';
 * import { InlineCode } from 'jg-react-ui/components/inline-code';
 * const example = createElement(InlineCode, { children: 'config/theme.ts' });
 */
export const InlineCode = ({
  className,
  children,
  ...props
}: IInlineCodeProps): React.ReactElement => (
  <code
    className={cn(
      'bg-code text-code-foreground relative w-fit max-w-full rounded-md px-1.5 py-1 font-mono text-[0.86em] font-semibold wrap-break-word in-data-[slot=tooltip-content]:bg-current/10 in-data-[slot=tooltip-content]:text-inherit',
      className,
    )}
    {...props}
  >
    {typeof children === 'string'
      ? splitCodeSegments(children).map((segment, index) => (
          <Fragment key={index}>
            {index > 0 ? <wbr /> : null}
            {segment}
          </Fragment>
        ))
      : children}
  </code>
);
