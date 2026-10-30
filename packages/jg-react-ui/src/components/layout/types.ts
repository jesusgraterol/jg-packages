import type * as React from 'react';

// layout primitive props preserve semantic element contracts for page composition.
/** Options and native attributes for PageShell.
 * @see layout
 */
export type IPageShellProps = React.ComponentProps<'main'>;
/** Options and native attributes for PageHeader.
 * @see layout
 */
export type IPageHeaderProps = React.ComponentProps<'header'>;
/** Options and native attributes for PageHeaderMetadata.
 * @see layout
 */
export type IPageHeaderMetadataProps = React.ComponentProps<'div'>;
/** Options and native attributes for PageHeaderRow.
 * @see layout
 */
export type IPageHeaderRowProps = React.ComponentProps<'div'>;
/** Options and native attributes for PageHeaderTitleGroup.
 * @see layout
 */
export type IPageHeaderTitleGroupProps = React.ComponentProps<'div'>;
/** Options and native attributes for PageTitle.
 * @see layout
 */
export type IPageTitleProps = React.ComponentProps<'h1'>;
/** Options and native attributes for PageDescription.
 * @see layout
 */
export type IPageDescriptionProps = React.ComponentProps<'p'>;
/** Options and native attributes for Stack.
 * @see layout
 */
export type IStackProps = React.ComponentProps<'div'>;
/** Options and native attributes for Inline.
 * @see layout
 */
export type IInlineProps = React.ComponentProps<'div'>;
/** Options and native attributes for Surface.
 * @see layout
 */
export type ISurfaceProps = React.ComponentProps<'section'>;
