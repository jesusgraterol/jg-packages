import type * as React from 'react';
import { cn } from 'cnfast';
import { headingClassNames, headingVariants } from './constants.js';
import type {
  IArticleProps,
  IArticleHeaderProps,
  ISectionProps,
  IParagraphProps,
  ILeadProps,
  ILargeTextProps,
  ISmallTextProps,
  IMutedTextProps,
  IBlockquoteProps,
  IUnorderedListProps,
  IOrderedListProps,
  IListItemProps,
  IKeyboardKeyProps,
  ITableContainerProps,
  ITableProps,
  ITableRowProps,
  ITableHeaderCellProps,
  ITableCellProps,
  IHeadingRole,
  IHeadingProps,
} from './types.js';

/** Identifies values owned by the heading typography role contract. */
const isHeadingRole = (role: IHeadingProps['role']): role is IHeadingRole =>
  role === 'display' ||
  role === 'public-page' ||
  role === 'section' ||
  role === 'product-page' ||
  role === 'product-statement';

/**
 * Renders a readable article-width container.
 * @param props The article element props.
 * @returns A React element that renders the article.
 * @example
 * import { createElement } from 'react';
 * import { Article } from 'jg-react-ui/components/typography';
 * const example = createElement(Article, { children: 'Project settings' });
 */
export const Article = ({ className, ...props }: IArticleProps): React.ReactElement => (
  <article
    className={cn('mx-auto w-full max-w-3xl min-w-0', className)}
    {...props}
  />
);

/**
 * Renders an article header with compact bottom spacing.
 * @param props The header element props.
 * @returns A React element that renders the article header.
 * @example
 * import { createElement } from 'react';
 * import { ArticleHeader } from 'jg-react-ui/components/typography';
 * const example = createElement(ArticleHeader, { children: 'Project settings' });
 */
export const ArticleHeader = ({ className, ...props }: IArticleHeaderProps): React.ReactElement => (
  <header
    className={cn('pb-2', className)}
    {...props}
  />
);

/**
 * Renders a prose section with consistent vertical spacing.
 * @param props The section element props.
 * @returns A React element that renders the section.
 * @example
 * import { createElement } from 'react';
 * import { Section } from 'jg-react-ui/components/typography';
 * const example = createElement(Section, { children: 'Project settings' });
 */
export const Section = ({ className, ...props }: ISectionProps): React.ReactElement => (
  <section
    className={cn('mt-12 scroll-m-12 first:mt-0', className)}
    {...props}
  />
);

/**
 * Renders a semantic heading for the supported typography scale.
 * @param props The heading props and required heading level.
 * @returns A React element that renders the selected heading element.
 * @example
 * import { createElement } from 'react';
 * import { Heading } from 'jg-react-ui/components/typography';
 * const example = createElement(Heading, { level: 2, children: 'Project settings' });
 */
export const Heading = ({
  className,
  level,
  role,
  ...props
}: IHeadingProps): React.ReactElement => {
  const headingRole = isHeadingRole(role) ? role : undefined;
  const headingClassName = cn(
    headingRole === undefined ? headingClassNames[level] : headingVariants({ role: headingRole }),
    className,
  );
  const ariaRole = headingRole === undefined ? role : undefined;

  if (level === 1) {
    return (
      <h1
        role={ariaRole}
        className={headingClassName}
        {...props}
      />
    );
  }

  if (level === 2) {
    return (
      <h2
        role={ariaRole}
        className={headingClassName}
        {...props}
      />
    );
  }

  if (level === 3) {
    return (
      <h3
        role={ariaRole}
        className={headingClassName}
        {...props}
      />
    );
  }

  if (level === 4) {
    return (
      <h4
        role={ariaRole}
        className={headingClassName}
        {...props}
      />
    );
  }

  return (
    <h5
      role={ariaRole}
      className={headingClassName}
      {...props}
    />
  );
};

/**
 * Renders a default prose paragraph.
 * @param props The paragraph props.
 * @returns A React element that renders the paragraph.
 * @example
 * import { createElement } from 'react';
 * import { Paragraph } from 'jg-react-ui/components/typography';
 * const example = createElement(Paragraph, { children: 'Project settings' });
 */
export const Paragraph = ({ className, ...props }: IParagraphProps): React.ReactElement => (
  <p
    className={cn('mt-6 leading-7 wrap-break-word first:mt-0', className)}
    {...props}
  />
);

/**
 * Renders emphasized introductory prose.
 * @param props The paragraph props.
 * @returns A React element that renders the lead text.
 * @example
 * import { createElement } from 'react';
 * import { Lead } from 'jg-react-ui/components/typography';
 * const example = createElement(Lead, { children: 'Project settings' });
 */
export const Lead = ({ className, ...props }: ILeadProps): React.ReactElement => (
  <p
    className={cn(
      'text-secondary-foreground mt-6 text-lg leading-8 wrap-break-word first:mt-0 sm:text-xl',
      className,
    )}
    {...props}
  />
);

/**
 * Renders larger emphasized inline prose.
 * @param props The paragraph props.
 * @returns A React element that renders the large text.
 * @example
 * import { createElement } from 'react';
 * import { LargeText } from 'jg-react-ui/components/typography';
 * const example = createElement(LargeText, { children: 'Project settings' });
 */
export const LargeText = ({ className, ...props }: ILargeTextProps): React.ReactElement => (
  <p
    className={cn('mt-6 text-base font-semibold wrap-break-word first:mt-0 sm:text-lg', className)}
    {...props}
  />
);

/**
 * Renders small supporting text with block layout.
 * @param props The small element props.
 * @returns A React element that renders the small text.
 * @example
 * import { createElement } from 'react';
 * import { SmallText } from 'jg-react-ui/components/typography';
 * const example = createElement(SmallText, { children: 'Project settings' });
 */
export const SmallText = ({ className, ...props }: ISmallTextProps): React.ReactElement => (
  <small
    className={cn(
      'mt-6 block text-sm leading-none font-medium wrap-break-word first:mt-0',
      className,
    )}
    {...props}
  />
);

/**
 * Renders lower-emphasis supporting prose.
 * @param props The paragraph props.
 * @returns A React element that renders the muted text.
 * @example
 * import { createElement } from 'react';
 * import { MutedText } from 'jg-react-ui/components/typography';
 * const example = createElement(MutedText, { children: 'Project settings' });
 */
export const MutedText = ({ className, ...props }: IMutedTextProps): React.ReactElement => (
  <p
    className={cn('text-secondary-foreground mt-6 text-sm wrap-break-word first:mt-0', className)}
    {...props}
  />
);

/**
 * Renders a prose blockquote with left-border treatment.
 * @param props The blockquote props.
 * @returns A React element that renders the blockquote.
 * @example
 * import { createElement } from 'react';
 * import { Blockquote } from 'jg-react-ui/components/typography';
 * const example = createElement(Blockquote, { children: 'Project settings' });
 */
export const Blockquote = ({ className, ...props }: IBlockquoteProps): React.ReactElement => (
  <blockquote
    className={cn('mt-6 border-border border-l-2 pl-6 wrap-break-word italic', className)}
    {...props}
  />
);

/**
 * Renders a prose unordered list.
 * @param props The unordered list props.
 * @returns A React element that renders the unordered list.
 * @example
 * import { createElement } from 'react';
 * import { UnorderedList } from 'jg-react-ui/components/typography';
 * const example = createElement(UnorderedList, { children: 'Project settings' });
 */
export const UnorderedList = ({ className, ...props }: IUnorderedListProps): React.ReactElement => (
  <ul
    className={cn('my-6 ml-6 list-disc [&>li]:mt-2 [&>li:first-child]:mt-0', className)}
    {...props}
  />
);

/**
 * Renders a prose ordered list.
 * @param props The ordered list props.
 * @returns A React element that renders the ordered list.
 * @example
 * import { createElement } from 'react';
 * import { OrderedList } from 'jg-react-ui/components/typography';
 * const example = createElement(OrderedList, { children: 'Project settings' });
 */
export const OrderedList = ({ className, ...props }: IOrderedListProps): React.ReactElement => (
  <ol
    className={cn('my-6 ml-6 list-decimal [&>li]:mt-2 [&>li:first-child]:mt-0', className)}
    {...props}
  />
);

/**
 * Renders a prose list item.
 * @param props The list item props.
 * @returns A React element that renders the list item.
 * @example
 * import { createElement } from 'react';
 * import { ListItem } from 'jg-react-ui/components/typography';
 * const example = createElement(ListItem, { children: 'Project settings' });
 */
export const ListItem = ({ className, ...props }: IListItemProps): React.ReactElement => (
  <li
    className={cn('wrap-break-word [&>p]:mt-0', className)}
    {...props}
  />
);

/**
 * Renders keyboard shortcut text with keycap styling.
 * @param props The keyboard element props.
 * @returns A React element that renders the keyboard key.
 * @example
 * import { createElement } from 'react';
 * import { KeyboardKey } from 'jg-react-ui/components/typography';
 * const example = createElement(KeyboardKey, { children: 'Project settings' });
 */
export const KeyboardKey = ({ className, ...props }: IKeyboardKeyProps): React.ReactElement => (
  <kbd
    className={cn(
      'bg-secondary rounded border px-1.5 py-0.5 font-mono text-xs font-medium in-data-[slot=tooltip-content]:border-current/15 in-data-[slot=tooltip-content]:bg-current/10 in-data-[slot=tooltip-content]:text-inherit',
      className,
    )}
    {...props}
  />
);

/**
 * Renders a horizontally scrollable wrapper for prose tables.
 * @param props The table container props.
 * @returns A React element that renders the table container.
 * @example
 * import { createElement } from 'react';
 * import { TableContainer } from 'jg-react-ui/components/typography';
 * const example = createElement(TableContainer, { children: 'Project settings' });
 */
export const TableContainer = ({
  className,
  ...props
}: ITableContainerProps): React.ReactElement => (
  <div
    className={cn('my-6 w-full max-w-full overflow-x-auto', className)}
    {...props}
  />
);

/**
 * Renders a full-width prose table.
 * @param props The table props.
 * @returns A React element that renders the table.
 * @example
 * import { createElement } from 'react';
 * import { Table } from 'jg-react-ui/components/typography';
 * const example = createElement(Table, { children: 'Project settings' });
 */
export const Table = ({ className, ...props }: ITableProps): React.ReactElement => (
  <table
    className={cn('w-full', className)}
    {...props}
  />
);

/**
 * Renders a prose table row.
 * @param props The table row props.
 * @returns A React element that renders the table row.
 * @example
 * import { createElement } from 'react';
 * import { TableRow } from 'jg-react-ui/components/typography';
 * const example = createElement(TableRow, { children: 'Project settings' });
 */
export const TableRow = ({ className, ...props }: ITableRowProps): React.ReactElement => (
  <tr
    className={cn('border-border m-0 border-t p-0', className)}
    {...props}
  />
);

/**
 * Renders a prose table header cell.
 * @param props The table header cell props.
 * @returns A React element that renders the table header cell.
 * @example
 * import { createElement } from 'react';
 * import { TableHeaderCell } from 'jg-react-ui/components/typography';
 * const example = createElement(TableHeaderCell, { scope: 'col', children: 'Name' });
 */
export const TableHeaderCell = ({
  className,
  ...props
}: ITableHeaderCellProps): React.ReactElement => (
  <th
    className={cn('border-border border px-4 py-2 text-left font-bold wrap-break-word', className)}
    {...props}
  />
);

/**
 * Renders a prose table body cell.
 * @param props The table cell props.
 * @returns A React element that renders the table cell.
 * @example
 * import { createElement } from 'react';
 * import { TableCell } from 'jg-react-ui/components/typography';
 * const example = createElement(TableCell, { children: 'Personal workspace' });
 */
export const TableCell = ({ className, ...props }: ITableCellProps): React.ReactElement => (
  <td
    className={cn('border-border border px-4 py-2 text-left wrap-break-word', className)}
    {...props}
  />
);
