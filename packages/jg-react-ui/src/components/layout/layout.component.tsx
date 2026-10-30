import type * as React from 'react';
import { cn } from 'cnfast';

import { headingVariants } from '../typography/index.js';

import type {
  IInlineProps,
  IPageDescriptionProps,
  IPageHeaderMetadataProps,
  IPageHeaderProps,
  IPageHeaderRowProps,
  IPageHeaderTitleGroupProps,
  IPageShellProps,
  IPageTitleProps,
  IStackProps,
  ISurfaceProps,
} from './types.js';

/**
 * Renders the main page shell with shared app spacing and background.
 * @param props The main element props.
 * @returns A React element that renders the page shell.
 * @example
 * import { createElement } from 'react';
 * import { PageShell } from 'jg-react-ui/components/layout';
 * const example = createElement(PageShell, { children: 'Project details' });
 */
export const PageShell = ({ className, ...props }: IPageShellProps): React.ReactElement => (
  <main
    data-slot="page-shell"
    className={cn('bg-background px-page-gutter min-h-0 py-4 sm:py-8', className)}
    {...props}
  />
);

/**
 * Renders a page header region with shared responsive spacing.
 * @param props The header element props.
 * @returns A React element that renders the page header.
 * @example
 * import { createElement } from 'react';
 * import { PageHeader } from 'jg-react-ui/components/layout';
 * const example = createElement(PageHeader, { children: 'Project details' });
 */
export const PageHeader = ({ className, ...props }: IPageHeaderProps): React.ReactElement => (
  <header
    data-slot="page-header"
    className={cn('mx-auto flow-root w-full max-w-none min-w-0 sm:grid sm:gap-3', className)}
    {...props}
  />
);

/**
 * Aligns the page title group with page-level actions across responsive layouts.
 * @param props The header-row element props.
 * @returns A React element that renders the responsive header row.
 * @example
 * import { createElement } from 'react';
 * import { PageHeaderRow } from 'jg-react-ui/components/layout';
 * const example = createElement(PageHeaderRow, { children: 'Project details' });
 */
export const PageHeaderRow = ({ className, ...props }: IPageHeaderRowProps): React.ReactElement => (
  <div
    data-slot="page-header-row"
    className={cn(
      'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 sm:gap-x-4',
      className,
    )}
    {...props}
  />
);

/**
 * Groups the page title and metadata on one responsive row.
 * @param props The title-group element props.
 * @returns A React element that renders the responsive title group.
 * @example
 * import { createElement } from 'react';
 * import { PageHeaderTitleGroup } from 'jg-react-ui/components/layout';
 * const example = createElement(PageHeaderTitleGroup, { children: 'Project details' });
 */
export const PageHeaderTitleGroup = ({
  className,
  ...props
}: IPageHeaderTitleGroupProps): React.ReactElement => (
  <div
    data-slot="page-header-title-group"
    className={cn(
      'flex w-full max-w-full min-w-0 items-center gap-2 overflow-hidden sm:gap-3',
      className,
    )}
    {...props}
  />
);

/**
 * Renders page-level metadata beside the title across responsive layouts.
 * @param props The metadata-group element props.
 * @returns A React element that renders the responsive metadata group.
 * @example
 * import { createElement } from 'react';
 * import { PageHeaderMetadata } from 'jg-react-ui/components/layout';
 * const example = createElement(PageHeaderMetadata, { children: 'Project details' });
 */
export const PageHeaderMetadata = ({
  className,
  ...props
}: IPageHeaderMetadataProps): React.ReactElement => (
  <div
    data-slot="page-header-metadata"
    className={cn('flex max-w-full shrink-0 items-center gap-2', className)}
    {...props}
  />
);

/**
 * Renders the primary page heading.
 * @param props The heading element props.
 * @returns A React element that renders the page title.
 * @example
 * import { createElement } from 'react';
 * import { PageTitle } from 'jg-react-ui/components/layout';
 * const example = createElement(PageTitle, { children: 'Project details' });
 */
export const PageTitle = ({ className, ...props }: IPageTitleProps): React.ReactElement => (
  <h1
    data-slot="page-title"
    className={cn(
      headingVariants({ role: 'product-page' }),
      'max-w-full min-w-0 shrink truncate text-nowrap',
      className,
    )}
    {...props}
  />
);

/**
 * Renders supporting page-level description text.
 * @param props The paragraph element props.
 * @returns A React element that renders the page description.
 * @example
 * import { createElement } from 'react';
 * import { PageDescription } from 'jg-react-ui/components/layout';
 * const example = createElement(PageDescription, { children: 'Project details' });
 */
export const PageDescription = ({
  className,
  ...props
}: IPageDescriptionProps): React.ReactElement => (
  <p
    data-slot="page-description"
    className={cn(
      'text-secondary-foreground mt-1 w-full max-w-3xl text-lg leading-8 wrap-break-word sm:mt-0',
      className,
    )}
    {...props}
  />
);

/**
 * Renders a vertical layout stack for grouped content.
 * @param props The div element props.
 * @returns A React element that renders the stack.
 * @example
 * import { createElement } from 'react';
 * import { Stack } from 'jg-react-ui/components/layout';
 * const example = createElement(Stack, { children: 'Project details' });
 */
export const Stack = ({ className, ...props }: IStackProps): React.ReactElement => (
  <div
    data-slot="stack"
    className={cn('grid min-w-0 gap-4', className)}
    {...props}
  />
);

/**
 * Renders a wrapping inline layout for compact controls and metadata.
 * @param props The div element props.
 * @returns A React element that renders the inline group.
 * @example
 * import { createElement } from 'react';
 * import { Inline } from 'jg-react-ui/components/layout';
 * const example = createElement(Inline, { children: 'Project details' });
 */
export const Inline = ({ className, ...props }: IInlineProps): React.ReactElement => (
  <div
    data-slot="inline"
    className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    {...props}
  />
);

/**
 * Renders a section surface for framed app content.
 * @param props The section element props.
 * @returns A React element that renders the surface.
 * @example
 * import { createElement } from 'react';
 * import { Surface } from 'jg-react-ui/components/layout';
 * const example = createElement(Surface, { children: 'Project details' });
 */
export const Surface = ({ className, ...props }: ISurfaceProps): React.ReactElement => (
  <section
    data-slot="surface"
    className={cn(
      'bg-background text-foreground shadow-surface rounded-lg border border-border p-4 sm:p-5',
      className,
    )}
    {...props}
  />
);
