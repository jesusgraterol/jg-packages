import { useContext } from 'react';
import type * as React from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import { cn } from 'cnfast';

import { InlineCode } from '../inline-code/index.js';
import { TextLink } from '../text-link/index.js';
import {
  Blockquote,
  CodeBlock,
  Heading,
  ListItem,
  OrderedList,
  Paragraph,
  Table,
  TableCell,
  TableContainer,
  TableHeaderCell,
  TableRow,
  UnorderedList,
} from '../typography/index.js';
import { YouTubeVideo } from '../youtube-video/index.js';
import { MarkdownPreContext, useMarkdownPreferences } from './markdown-preferences.context.js';
import {
  extractMarkdownText,
  getMarkdownHeadingClassName,
  getMarkdownImageDisplayWidth,
  getMarkdownYouTubeVideoDescriptor,
  isMarkdownWebNavigationHref,
  mergeSecureMarkdownLinkRel,
  omitMarkdownNode,
} from './utilities.js';

// React Markdown renderer props include the original mdast node plus native element props.
type IMarkdownComponentProps<TKey extends keyof React.JSX.IntrinsicElements> =
  React.JSX.IntrinsicElements[TKey] & ExtraProps;

/**
 * Renders a level-one markdown heading through the shared heading primitive.
 * @param props The React Markdown h1 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingOne = (props: IMarkdownComponentProps<'h1'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <Heading
      level={1}
      className={getMarkdownHeadingClassName(className, { isLevelOne: true })}
      {...headingProps}
    />
  );
};

/**
 * Renders a level-two markdown heading through the shared heading primitive.
 * @param props The React Markdown h2 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingTwo = (props: IMarkdownComponentProps<'h2'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <Heading
      level={2}
      className={getMarkdownHeadingClassName(className)}
      {...headingProps}
    />
  );
};

/**
 * Renders a level-three markdown heading through the shared heading primitive.
 * @param props The React Markdown h3 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingThree = (props: IMarkdownComponentProps<'h3'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <Heading
      level={3}
      className={getMarkdownHeadingClassName(className)}
      {...headingProps}
    />
  );
};

/**
 * Renders a level-four markdown heading through the shared heading primitive.
 * @param props The React Markdown h4 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingFour = (props: IMarkdownComponentProps<'h4'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <Heading
      level={4}
      className={getMarkdownHeadingClassName(className)}
      {...headingProps}
    />
  );
};

/**
 * Renders a level-five markdown heading through the shared heading primitive.
 * @param props The React Markdown h5 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingFive = (props: IMarkdownComponentProps<'h5'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <Heading
      level={5}
      className={getMarkdownHeadingClassName(className)}
      {...headingProps}
    />
  );
};

/**
 * Renders level-six markdown headings with a compact local style outside the shared heading scale.
 * @param props The React Markdown h6 renderer props.
 * @returns A React element that renders the markdown heading.
 */
const renderMarkdownHeadingSix = (props: IMarkdownComponentProps<'h6'>): React.ReactElement => {
  const { className, ...headingProps } = omitMarkdownNode(props);

  return (
    <h6
      className={cn(
        'scroll-m-20 text-sm font-semibold tracking-normal wrap-break-word sm:text-base',
        getMarkdownHeadingClassName(className),
      )}
      {...headingProps}
    />
  );
};

/**
 * Renders a markdown paragraph through the shared prose primitive.
 * @param props The React Markdown paragraph renderer props.
 * @returns A React element that renders the markdown paragraph.
 */
const renderMarkdownParagraph = (props: IMarkdownComponentProps<'p'>): React.ReactElement => {
  const youtubeVideo = getMarkdownYouTubeVideoDescriptor(props.node);

  if (youtubeVideo) {
    return (
      <YouTubeVideo
        className="mt-6 first:mt-0"
        title={youtubeVideo.title}
        videoId={youtubeVideo.videoId}
      />
    );
  }

  const { className, ...paragraphProps } = omitMarkdownNode(props);

  return (
    <Paragraph
      className={className}
      {...paragraphProps}
    />
  );
};

/**
 * Renders a markdown anchor through the shared text-link primitive.
 * @param props The React Markdown anchor renderer props.
 * @returns A React element that renders the markdown link.
 */
const MarkdownAnchor = (props: IMarkdownComponentProps<'a'>): React.ReactElement => {
  const { children, className, href, rel, target, ...linkProps } = omitMarkdownNode(props);
  const { shouldOpenLinksInNewTab } = useMarkdownPreferences();
  const shouldOpenInNewTab = shouldOpenLinksInNewTab === true && isMarkdownWebNavigationHref(href);

  return (
    <TextLink
      className={className}
      href={href}
      rel={shouldOpenInNewTab ? mergeSecureMarkdownLinkRel(rel) : rel}
      target={shouldOpenInNewTab ? '_blank' : target}
      {...linkProps}
    >
      {children}
    </TextLink>
  );
};

/**
 * Renders a markdown blockquote through the shared prose primitive.
 * @param props The React Markdown blockquote renderer props.
 * @returns A React element that renders the markdown blockquote.
 */
const renderMarkdownBlockquote = (
  props: IMarkdownComponentProps<'blockquote'>,
): React.ReactElement => {
  const { className, ...blockquoteProps } = omitMarkdownNode(props);

  return (
    <Blockquote
      className={className}
      {...blockquoteProps}
    />
  );
};

/**
 * Renders a markdown unordered list through the shared prose primitive.
 * @param props The React Markdown unordered list renderer props.
 * @returns A React element that renders the markdown unordered list.
 */
const renderMarkdownUnorderedList = (props: IMarkdownComponentProps<'ul'>): React.ReactElement => {
  const { className, ...listProps } = omitMarkdownNode(props);

  return (
    <UnorderedList
      className={className}
      {...listProps}
    />
  );
};

/**
 * Renders a markdown ordered list through the shared prose primitive.
 * @param props The React Markdown ordered list renderer props.
 * @returns A React element that renders the markdown ordered list.
 */
const renderMarkdownOrderedList = (props: IMarkdownComponentProps<'ol'>): React.ReactElement => {
  const { className, ...listProps } = omitMarkdownNode(props);

  return (
    <OrderedList
      className={className}
      {...listProps}
    />
  );
};

/**
 * Renders a markdown list item through the shared prose primitive.
 * @param props The React Markdown list item renderer props.
 * @returns A React element that renders the markdown list item.
 */
const renderMarkdownListItem = (props: IMarkdownComponentProps<'li'>): React.ReactElement => {
  const { className, ...listItemProps } = omitMarkdownNode(props);

  return (
    <ListItem
      className={className}
      {...listItemProps}
    />
  );
};

/**
 * Renders a markdown thematic break with app-ui border spacing.
 * @param props The React Markdown thematic break renderer props.
 * @returns A React element that renders the markdown divider.
 */
const renderMarkdownThematicBreak = (props: IMarkdownComponentProps<'hr'>): React.ReactElement => {
  const { className, ...dividerProps } = omitMarkdownNode(props);

  return (
    <hr
      className={cn('border-border my-8', className)}
      {...dividerProps}
    />
  );
};

/**
 * Renders preformatted markdown content without adding an extra wrapper.
 * @param props The React Markdown pre renderer props.
 * @returns A React fragment containing the preformatted children.
 */
const renderMarkdownPre = (props: IMarkdownComponentProps<'pre'>): React.ReactElement => {
  const { children } = omitMarkdownNode(props);

  return <MarkdownPreContext value>{children}</MarkdownPreContext>;
};

/**
 * Renders inline and fenced markdown code through the shared code primitives.
 * @param props The React Markdown code renderer props.
 * @returns A React element that renders the markdown code.
 */
const MarkdownCode = (props: IMarkdownComponentProps<'code'>): React.ReactElement => {
  const { className, children, ...codeProps } = omitMarkdownNode(props);
  const languageMatch = /language-([\w-]+)/.exec(className ?? '');
  const { prefersWrappedCode } = useMarkdownPreferences();
  const isCodeBlock = useContext(MarkdownPreContext);

  if (isCodeBlock || languageMatch) {
    return (
      <CodeBlock
        language={languageMatch?.[1]}
        prefersWrappedCode={prefersWrappedCode}
      >
        {extractMarkdownText(children)}
      </CodeBlock>
    );
  }

  return (
    <InlineCode
      className={className}
      {...codeProps}
    >
      {children}
    </InlineCode>
  );
};

/**
 * Renders a markdown table inside the shared horizontal overflow container.
 * @param props The React Markdown table renderer props.
 * @returns A React element that renders the markdown table.
 */
const renderMarkdownTable = (props: IMarkdownComponentProps<'table'>): React.ReactElement => {
  const { className, ...tableProps } = omitMarkdownNode(props);

  return (
    <TableContainer
      role="group"
      aria-label="Scrollable table"
      tabIndex={0}
      className="wrap-normal focus-visible:outline-2 focus-visible:outline-foreground"
    >
      <Table
        className={className}
        {...tableProps}
      />
    </TableContainer>
  );
};

/**
 * Renders a markdown table row through the shared prose primitive.
 * @param props The React Markdown table row renderer props.
 * @returns A React element that renders the markdown table row.
 */
const renderMarkdownTableRow = (props: IMarkdownComponentProps<'tr'>): React.ReactElement => {
  const { className, ...rowProps } = omitMarkdownNode(props);

  return (
    <TableRow
      className={className}
      {...rowProps}
    />
  );
};

/**
 * Renders a markdown table header cell through the shared prose primitive.
 * @param props The React Markdown table header cell renderer props.
 * @returns A React element that renders the markdown table header cell.
 */
const renderMarkdownTableHeaderCell = (
  props: IMarkdownComponentProps<'th'>,
): React.ReactElement => {
  const { className, ...headerCellProps } = omitMarkdownNode(props);

  return (
    <TableHeaderCell
      className={className}
      {...headerCellProps}
    />
  );
};

/**
 * Renders a markdown table body cell through the shared prose primitive.
 * @param props The React Markdown table body cell renderer props.
 * @returns A React element that renders the markdown table body cell.
 */
const renderMarkdownTableCell = (props: IMarkdownComponentProps<'td'>): React.ReactElement => {
  const { className, ...cellProps } = omitMarkdownNode(props);

  return (
    <TableCell
      className={className}
      {...cellProps}
    />
  );
};

/**
 * Renders markdown deleted text with consistent line-through styling.
 * @param props The React Markdown deleted text renderer props.
 * @returns A React element that renders the markdown deleted text.
 */
const renderMarkdownDeletedText = (props: IMarkdownComponentProps<'del'>): React.ReactElement => {
  const { className, ...strikeProps } = omitMarkdownNode(props);

  return (
    <del
      className={cn('line-through', className)}
      {...strikeProps}
    />
  );
};

/**
 * Renders markdown images with lazy loading and shared media framing.
 * @param props The React Markdown image renderer props.
 * @returns A React element that renders the markdown image.
 */
const renderMarkdownImage = (props: IMarkdownComponentProps<'img'>): React.ReactElement => {
  const { alt, className, style, title, ...imageProps } = omitMarkdownNode(props);
  const displayWidth = getMarkdownImageDisplayWidth(title);

  return (
    <img
      alt={alt ?? ''}
      className={cn(
        'bg-background shadow-inset mx-auto mt-6 h-auto w-full rounded-lg border border-border object-cover first:mt-0',
        className,
      )}
      decoding="async"
      loading="lazy"
      style={displayWidth === undefined ? style : { ...style, maxWidth: displayWidth }}
      title={displayWidth === undefined ? title : undefined}
      {...imageProps}
    />
  );
};

/**
 * Renders markdown inputs, including checked task-list items, with shared form sizing.
 * @param props The React Markdown input renderer props.
 * @returns A React element that renders the markdown input.
 */
const renderMarkdownInput = (props: IMarkdownComponentProps<'input'>): React.ReactElement => {
  const { className, type, ...inputProps } = omitMarkdownNode(props);

  if (type === 'checkbox') {
    return (
      <input
        className={cn(
          'border-border accent-primary mr-2 inline-block size-4 rounded-sm border align-middle',
          className,
        )}
        type="checkbox"
        {...inputProps}
      />
    );
  }

  return (
    <input
      className={className}
      type={type}
      {...inputProps}
    />
  );
};

/**
 * Renders generated markdown sections with subdued document metadata styling.
 * @param props The React Markdown section renderer props.
 * @returns A React element that renders the markdown section.
 */
const renderMarkdownSection = (props: IMarkdownComponentProps<'section'>): React.ReactElement => {
  const { className, ...sectionProps } = omitMarkdownNode(props);

  return (
    <section
      className={cn('text-secondary-foreground mt-10 border-t pt-6 text-sm', className)}
      {...sectionProps}
    />
  );
};

/**
 * Renders markdown superscript text with compact vertical alignment.
 * @param props The React Markdown superscript renderer props.
 * @returns A React element that renders the markdown superscript text.
 */
const renderMarkdownSuperscript = (props: IMarkdownComponentProps<'sup'>): React.ReactElement => {
  const { className, ...supProps } = omitMarkdownNode(props);

  return (
    <sup
      className={cn('align-super text-xs', className)}
      {...supProps}
    />
  );
};

// default markdown component renderers map common markdown nodes to app-ui typography primitives.
export const defaultMarkdownComponents: Components = {
  h1: renderMarkdownHeadingOne,
  h2: renderMarkdownHeadingTwo,
  h3: renderMarkdownHeadingThree,
  h4: renderMarkdownHeadingFour,
  h5: renderMarkdownHeadingFive,
  h6: renderMarkdownHeadingSix,
  p: renderMarkdownParagraph,
  a: MarkdownAnchor,
  blockquote: renderMarkdownBlockquote,
  ul: renderMarkdownUnorderedList,
  ol: renderMarkdownOrderedList,
  li: renderMarkdownListItem,
  hr: renderMarkdownThematicBreak,
  pre: renderMarkdownPre,
  code: MarkdownCode,
  table: renderMarkdownTable,
  tr: renderMarkdownTableRow,
  th: renderMarkdownTableHeaderCell,
  td: renderMarkdownTableCell,
  del: renderMarkdownDeletedText,
  img: renderMarkdownImage,
  input: renderMarkdownInput,
  section: renderMarkdownSection,
  sup: renderMarkdownSuperscript,
};
