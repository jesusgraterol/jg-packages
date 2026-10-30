import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { headingClassNames, headingVariants } from './constants.js';

/** Native attributes and shared options for Article.
 * @see Article
 */
export type IArticleProps = React.ComponentProps<'article'>;

/** Native attributes and shared options for ArticleHeader.
 * @see ArticleHeader
 */
export type IArticleHeaderProps = React.ComponentProps<'header'>;

/** Native attributes and shared options for Section.
 * @see Section
 */
export type ISectionProps = React.ComponentProps<'section'>;

/** Native attributes and shared options for Paragraph.
 * @see Paragraph
 */
export type IParagraphProps = React.ComponentProps<'p'>;

/** Native attributes and shared options for Lead.
 * @see Lead
 */
export type ILeadProps = React.ComponentProps<'p'>;

/** Native attributes and shared options for LargeText.
 * @see LargeText
 */
export type ILargeTextProps = React.ComponentProps<'p'>;

/** Native attributes and shared options for SmallText.
 * @see SmallText
 */
export type ISmallTextProps = React.ComponentProps<'small'>;

/** Native attributes and shared options for MutedText.
 * @see MutedText
 */
export type IMutedTextProps = React.ComponentProps<'p'>;

/** Native attributes and shared options for Blockquote.
 * @see Blockquote
 */
export type IBlockquoteProps = React.ComponentProps<'blockquote'>;

/** Native attributes and shared options for UnorderedList.
 * @see UnorderedList
 */
export type IUnorderedListProps = React.ComponentProps<'ul'>;

/** Native attributes and shared options for OrderedList.
 * @see OrderedList
 */
export type IOrderedListProps = React.ComponentProps<'ol'>;

/** Native attributes and shared options for ListItem.
 * @see ListItem
 */
export type IListItemProps = React.ComponentProps<'li'>;

/** Native attributes and shared options for KeyboardKey.
 * @see KeyboardKey
 */
export type IKeyboardKeyProps = React.ComponentProps<'kbd'>;

/** Native attributes and shared options for TableContainer.
 * @see TableContainer
 */
export type ITableContainerProps = React.ComponentProps<'div'>;

/** Native attributes and shared options for Table.
 * @see Table
 */
export type ITableProps = React.ComponentProps<'table'>;

/** Native attributes and shared options for TableRow.
 * @see TableRow
 */
export type ITableRowProps = React.ComponentProps<'tr'>;

/** Native attributes and shared options for TableHeaderCell.
 * @see TableHeaderCell
 */
export type ITableHeaderCellProps = React.ComponentProps<'th'>;

/** Native attributes and shared options for TableCell.
 * @see TableCell
 */
export type ITableCellProps = React.ComponentProps<'td'>;

/** Supported heading levels intentionally stop at h5 for the shared prose scale.
 * @see Heading
 */
export type IHeadingLevel = keyof typeof headingClassNames;

/** Statement roles style headings independently from their semantic level.
 * @see Heading
 */
export type IHeadingRole = NonNullable<VariantProps<typeof headingVariants>['role']>;

/** Native attributes and shared options for Heading.
 * @see Heading
 */
export type IHeadingProps = Omit<React.HTMLAttributes<HTMLHeadingElement>, 'role'> & {
  level: IHeadingLevel;
  role?: IHeadingRole | React.AriaRole;
};
