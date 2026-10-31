import type * as React from 'react';

import type {
  MARKDOWN_EDITOR_ALL_TOOLS,
  MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS,
  MARKDOWN_EDITOR_HEADING_LEVELS,
  MARKDOWN_EDITOR_LAYOUTS,
  MARKDOWN_EDITOR_TURN_INTO_OPTIONS,
} from './constants.js';
import type {
  IChatMarkdownEditorInternalControls,
  IChatMarkdownPolicyOptions,
} from './chat-editor/types.js';

/** A tool accepted by the document editor authoring policy.
 * @see MARKDOWN_EDITOR_TOOLS
 */
export type IMarkdownEditorTool = (typeof MARKDOWN_EDITOR_ALL_TOOLS)[number];

// heading levels recognized in Markdown documents.
export type IMarkdownEditorHeadingLevel = (typeof MARKDOWN_EDITOR_HEADING_LEVELS)[number];

// heading levels exposed by MarkdownEditor authoring controls.
export type IMarkdownEditorAuthoringHeadingLevel =
  (typeof MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS)[number];

/** An automatic container-responsive or explicit editor layout.
 * @see MARKDOWN_EDITOR_LAYOUTS
 */
export type IMarkdownEditorLayout =
  (typeof MARKDOWN_EDITOR_LAYOUTS)[keyof typeof MARKDOWN_EDITOR_LAYOUTS];

// resolved editor layouts exclude the automatic container-width policy.
export type IResolvedMarkdownEditorLayout = Exclude<IMarkdownEditorLayout, 'auto'>;

// block action targets keep enough ProseMirror location data to apply menu commands safely.
export type IMarkdownEditorBlockActionTarget = {
  from: number;
  headingLevel: IMarkdownEditorHeadingLevel | null;
  isTextBlock: boolean;
  nodeTypeName: string;
  plainTextContent: string;
  to: number;
};

// turn-into menu options mirror the visible markdown block commands.
export type IMarkdownEditorTurnIntoOption = (typeof MARKDOWN_EDITOR_TURN_INTO_OPTIONS)[number];
export type IMarkdownEditorTurnIntoOptionKind = IMarkdownEditorTurnIntoOption['kind'];

// viewport-constrained menu geometry is stored with the block action target it operates on.
export type IMarkdownEditorBlockActionMenuState = {
  left: number;
  maxHeight: number;
  target: IMarkdownEditorBlockActionTarget;
  top: number;
};

// viewport rectangles provide the geometry required to clamp a floating editor menu.
export type IMarkdownEditorMenuViewportRect = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

// fixed menu positions use viewport-relative coordinates.
export type IMarkdownEditorMenuFixedPosition = {
  left: number;
  top: number;
};

// the slash-menu portal controller is scoped to one rendered editor instance.
export type IMarkdownEditorSlashMenuPortalOptions = {
  editorWrapper: HTMLElement;
  ownerId: string;
};

/** Controlled Markdown document props and authoring restrictions.
 * @see MarkdownEditor
 */
export type IMarkdownEditorProps = Pick<
  React.ComponentProps<'div'>,
  'aria-describedby' | 'aria-invalid' | 'aria-label' | 'aria-required' | 'className'
> & {
  disabled?: boolean;
  layout?: IMarkdownEditorLayout;
  onChange: (value: string) => void;
  placeholder?: string;
  supportedTools?: ReadonlyArray<IMarkdownEditorTool>;
  value: string;
};

/** Controlled document props with layout selected by the explicit component.
 * @see CompactMarkdownEditor
 * @see WideMarkdownEditor
 */
export type IMarkdownEditorVariantProps = Omit<IMarkdownEditorProps, 'layout'>;

// internal editor props extend the variant contract with the active document theme.
export type IMarkdownEditorContentProps = IMarkdownEditorVariantProps & {
  chatOptions?: IChatMarkdownPolicyOptions & {
    controlsRef: React.Ref<IChatMarkdownEditorInternalControls>;
    onSubmitRequest?: ((markdown: string) => void) | undefined;
  };
  editorMode?: 'chat' | 'document';
  isDarkMode: boolean;
};

// responsive layout hook result binds the measured container to its resolved editor layout.
export type IMarkdownEditorLayoutResult = {
  containerRef: (element: HTMLDivElement | null) => void;
  resolvedLayout: IResolvedMarkdownEditorLayout | null;
};

// internal block action menu props keep the portal menu stateless and command-oriented.
export type IMarkdownEditorBlockActionMenuProps = {
  activeKind: IMarkdownEditorTurnIntoOptionKind | null;
  left: number;
  maxHeight: number;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: (shouldRestoreFocus?: boolean) => void;
  onDelete: () => void;
  onTurnInto: (option: IMarkdownEditorTurnIntoOption) => void;
  supportedTools: ReadonlyArray<IMarkdownEditorTool>;
  target: IMarkdownEditorBlockActionTarget;
  top: number;
};
