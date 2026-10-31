// types
export type {
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
  IHeadingLevel,
  IHeadingRole,
  IHeadingProps,
} from './types.js';

// variants
export { headingVariants } from './constants.js';

// components
export {
  Article,
  ArticleHeader,
  Section,
  Heading,
  Paragraph,
  Lead,
  LargeText,
  SmallText,
  MutedText,
  Blockquote,
  UnorderedList,
  OrderedList,
  ListItem,
  KeyboardKey,
  TableContainer,
  Table,
  TableRow,
  TableHeaderCell,
  TableCell,
} from './typography.component.js';

// code presentation
export type { ICodeBlockProps, ICodeFileStatus } from './types.js';
export { CodeBlock } from './code-block.component.js';
export { isCodeBlockProse } from './utilities.js';
export { codeFileStatusVariants } from './constants.js';
export { CodeFileHeader, type ICodeFileHeaderProps } from './code-file-header/index.js';
