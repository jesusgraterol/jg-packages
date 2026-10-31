/** Container-responsive and explicit document layouts.
 * @see MarkdownEditor
 */
export const MARKDOWN_EDITOR_LAYOUTS = {
  Auto: 'auto',
  Compact: 'compact',
  Wide: 'wide',
} as const;

// minimum available container width that can accommodate the wide editor controls.
export const MARKDOWN_EDITOR_WIDE_MIN_WIDTH_PX = 640;

/** Authoring tool identifiers for document editors.
 * @see IMarkdownEditorProps
 */
export const MARKDOWN_EDITOR_TOOLS = {
  Bold: 'bold',
  BulletList: 'bullet-list',
  CodeBlock: 'code-block',
  Divider: 'divider',
  Heading: 'heading',
  Image: 'image',
  InlineCode: 'inline-code',
  Italic: 'italic',
  Link: 'link',
  Math: 'math',
  OrderedList: 'ordered-list',
  Quote: 'quote',
  Strikethrough: 'strikethrough',
  Table: 'table',
  TableAlignment: 'table-alignment',
  TaskList: 'task-list',
  Text: 'text',
  Variable: 'variable',
  YouTube: 'youtube',
} as const;

/** Complete default tool policy used when supportedTools is omitted.
 * @see MarkdownEditor
 */
export const MARKDOWN_EDITOR_ALL_TOOLS = [
  MARKDOWN_EDITOR_TOOLS.Text,
  MARKDOWN_EDITOR_TOOLS.Heading,
  MARKDOWN_EDITOR_TOOLS.Bold,
  MARKDOWN_EDITOR_TOOLS.Italic,
  MARKDOWN_EDITOR_TOOLS.Strikethrough,
  MARKDOWN_EDITOR_TOOLS.InlineCode,
  MARKDOWN_EDITOR_TOOLS.Link,
  MARKDOWN_EDITOR_TOOLS.Variable,
  MARKDOWN_EDITOR_TOOLS.Quote,
  MARKDOWN_EDITOR_TOOLS.Divider,
  MARKDOWN_EDITOR_TOOLS.BulletList,
  MARKDOWN_EDITOR_TOOLS.OrderedList,
  MARKDOWN_EDITOR_TOOLS.TaskList,
  MARKDOWN_EDITOR_TOOLS.CodeBlock,
  MARKDOWN_EDITOR_TOOLS.Table,
  MARKDOWN_EDITOR_TOOLS.TableAlignment,
  MARKDOWN_EDITOR_TOOLS.Image,
  MARKDOWN_EDITOR_TOOLS.YouTube,
  MARKDOWN_EDITOR_TOOLS.Math,
] as const;

/** Constrained document authoring tools, including variables, code and tables.
 * @see IMarkdownEditorProps
 */
export const MARKDOWN_EDITOR_AUTHORING_TOOLS = [
  MARKDOWN_EDITOR_TOOLS.Text,
  MARKDOWN_EDITOR_TOOLS.Heading,
  MARKDOWN_EDITOR_TOOLS.Bold,
  MARKDOWN_EDITOR_TOOLS.Italic,
  MARKDOWN_EDITOR_TOOLS.InlineCode,
  MARKDOWN_EDITOR_TOOLS.Link,
  MARKDOWN_EDITOR_TOOLS.Variable,
  MARKDOWN_EDITOR_TOOLS.Quote,
  MARKDOWN_EDITOR_TOOLS.BulletList,
  MARKDOWN_EDITOR_TOOLS.OrderedList,
  MARKDOWN_EDITOR_TOOLS.CodeBlock,
  MARKDOWN_EDITOR_TOOLS.Table,
] as const;

/** Prose authoring tools without template variables or code blocks, retaining inline code.
 * @see MARKDOWN_EDITOR_AUTHORING_TOOLS
 */
export const MARKDOWN_EDITOR_PROSE_TOOLS = MARKDOWN_EDITOR_AUTHORING_TOOLS.filter(
  (tool) => tool !== MARKDOWN_EDITOR_TOOLS.Variable && tool !== MARKDOWN_EDITOR_TOOLS.CodeBlock,
);

// floating-toolbar action order mirrors Crepe's built-in toolbar render order.
export const MARKDOWN_EDITOR_TOOLBAR_ACTIONS = [
  { ariaLabel: 'Bold', tool: MARKDOWN_EDITOR_TOOLS.Bold },
  { ariaLabel: 'Italic', tool: MARKDOWN_EDITOR_TOOLS.Italic },
  { ariaLabel: 'Strikethrough', tool: MARKDOWN_EDITOR_TOOLS.Strikethrough },
  { ariaLabel: 'Inline code', tool: MARKDOWN_EDITOR_TOOLS.InlineCode },
  { ariaLabel: 'Inline math', tool: MARKDOWN_EDITOR_TOOLS.Math },
  { ariaLabel: 'Insert link', tool: MARKDOWN_EDITOR_TOOLS.Link },
  { ariaLabel: 'Insert variable', tool: MARKDOWN_EDITOR_TOOLS.Variable },
] as const;

// table controls exposed by Crepe are relabeled before optional alignment filtering.
export const TABLE_COLUMN_BUTTON_LABELS = [
  'Align left',
  'Align center',
  'Align right',
  'Delete column',
] as const;

// heading levels recognized in Markdown documents.
export const MARKDOWN_EDITOR_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

// heading levels offered by MarkdownEditor authoring controls.
export const MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS = [1, 2, 3] as const;

// turn-into options mirror the authoring controls supported by this editor configuration.
export const MARKDOWN_EDITOR_TURN_INTO_OPTIONS = [
  { kind: 'paragraph', label: 'Text', tool: MARKDOWN_EDITOR_TOOLS.Text },
  { kind: 'heading-1', label: 'Heading 1', headingLevel: 1, tool: MARKDOWN_EDITOR_TOOLS.Heading },
  { kind: 'heading-2', label: 'Heading 2', headingLevel: 2, tool: MARKDOWN_EDITOR_TOOLS.Heading },
  { kind: 'heading-3', label: 'Heading 3', headingLevel: 3, tool: MARKDOWN_EDITOR_TOOLS.Heading },
  { kind: 'quote', label: 'Quote', tool: MARKDOWN_EDITOR_TOOLS.Quote },
  { kind: 'variable', label: 'Variable', tool: MARKDOWN_EDITOR_TOOLS.Variable },
  { kind: 'bullet-list', label: 'Bullet List', tool: MARKDOWN_EDITOR_TOOLS.BulletList },
  { kind: 'ordered-list', label: 'Ordered List', tool: MARKDOWN_EDITOR_TOOLS.OrderedList },
  { kind: 'code', label: 'Code', tool: MARKDOWN_EDITOR_TOOLS.CodeBlock },
  { kind: 'table', label: 'Table', tool: MARKDOWN_EDITOR_TOOLS.Table },
] as const;

// SVG element names supported by the shared editor icon node format.
type IMarkdownEditorSvgIconElementName = 'path' | 'rect';

// compact Lucide-style icon nodes shared by Crepe string icons and React rendering.
type IMarkdownEditorSvgIconNode = ReadonlyArray<
  readonly [IMarkdownEditorSvgIconElementName, Readonly<Record<string, string>>]
>;

// turn-into icons define the shared visual language for custom and Crepe menus.
export const MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES = {
  'bullet-list': [
    ['path', { d: 'M3 5h.01' }],
    ['path', { d: 'M3 12h.01' }],
    ['path', { d: 'M3 19h.01' }],
    ['path', { d: 'M8 5h13' }],
    ['path', { d: 'M8 12h13' }],
    ['path', { d: 'M8 19h13' }],
  ],
  'heading-1': [
    ['path', { d: 'M4 12h8' }],
    ['path', { d: 'M4 18V6' }],
    ['path', { d: 'M12 18V6' }],
    ['path', { d: 'm17 12 3-2v8' }],
  ],
  'heading-2': [
    ['path', { d: 'M4 12h8' }],
    ['path', { d: 'M4 18V6' }],
    ['path', { d: 'M12 18V6' }],
    ['path', { d: 'M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1' }],
  ],
  'heading-3': [
    ['path', { d: 'M4 12h8' }],
    ['path', { d: 'M4 18V6' }],
    ['path', { d: 'M12 18V6' }],
    ['path', { d: 'M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2' }],
    ['path', { d: 'M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2' }],
  ],
  'ordered-list': [
    ['path', { d: 'M11 5h10' }],
    ['path', { d: 'M11 12h10' }],
    ['path', { d: 'M11 19h10' }],
    ['path', { d: 'M4 4h1v5' }],
    ['path', { d: 'M4 9h2' }],
    ['path', { d: 'M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02' }],
  ],
  code: [
    ['path', { d: 'm16 18 6-6-6-6' }],
    ['path', { d: 'm8 6-6 6 6 6' }],
  ],
  paragraph: [
    ['path', { d: 'M13 4v16' }],
    ['path', { d: 'M17 4v16' }],
    ['path', { d: 'M19 4H9.5a4.5 4.5 0 0 0 0 9H13' }],
  ],
  quote: [
    [
      'path',
      {
        d: 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z',
      },
    ],
    [
      'path',
      {
        d: 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z',
      },
    ],
  ],
  table: [
    ['path', { d: 'M12 3v18' }],
    ['rect', { fill: 'none', height: '18', rx: '2', width: '18', x: '3', y: '3' }],
    ['path', { d: 'M3 9h18' }],
    ['path', { d: 'M3 15h18' }],
  ],
  variable: [
    ['path', { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1' }],
    ['path', { d: 'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1' }],
  ],
} as const satisfies Record<
  (typeof MARKDOWN_EDITOR_TURN_INTO_OPTIONS)[number]['kind'],
  IMarkdownEditorSvgIconNode
>;

// fixed menu sizing keeps viewport clamping deterministic before the menu is measured.
export const MARKDOWN_EDITOR_TURN_INTO_MENU_WIDTH = 224;

// desktop max menu height mirrors the default Crepe add-menu scroll area.
export const MARKDOWN_EDITOR_TURN_INTO_MENU_MAX_HEIGHT = 256;

// shorter mobile menu keeps its first options visible above compact viewport edges.
export const MARKDOWN_EDITOR_MOBILE_TURN_INTO_MENU_MAX_HEIGHT = 192;

// viewport padding prevents the turn-into menu from touching screen edges.
// floating editor menus keep this clearance from every viewport edge.
export const MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING = 8;

// the slash menu sits above base dialogs and nested alert dialogs while it is portaled.
export const MARKDOWN_EDITOR_SLASH_MENU_Z_INDEX = 70;

// horizontal gap between the block handle and the turn-into menu.
export const MARKDOWN_EDITOR_TURN_INTO_MENU_TRIGGER_GAP = 8;
