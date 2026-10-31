import type * as React from 'react';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { SelectionBookmark } from '@milkdown/kit/prose/state';
import type { z } from 'zod';

import type { IYouTubeVideoDescriptor } from '../../../shared/youtube-video/index.js';

import type { MarkdownEditorYouTubeVideoFormSchema } from './validations.js';

// internal form contracts distinguish authored fields from the canonical descriptor output.
export type IMarkdownEditorYouTubeVideoFormInput = z.input<
  typeof MarkdownEditorYouTubeVideoFormSchema
>;
export type IMarkdownEditorYouTubeVideoFormValues = z.output<
  typeof MarkdownEditorYouTubeVideoFormSchema
>;

// attributes persisted by the custom ProseMirror atom node.
export type IMarkdownEditorYouTubeVideoNodeAttributes = {
  title: string;
  watchUrl: string;
};

// insertion requests retain the exact document and slash block selected before the dialog opens.
export type IMarkdownEditorYouTubeVideoInsertionRequest = {
  blockDepth: number;
  blockPosition: number;
  blockText: string;
  doc: ProseMirrorNode;
  editorElement: HTMLElement;
  selectionBookmark: SelectionBookmark;
};

// edit requests retain the opening document, position evidence, and current focus resolver.
export type IMarkdownEditorYouTubeVideoEditRequest = {
  descriptor: IYouTubeVideoDescriptor;
  doc: ProseMirrorNode;
  getPos: () => number | undefined;
  position: number;
  resolveTriggerElement: () => HTMLButtonElement | null;
  triggerElement: HTMLButtonElement;
};

// dialog sessions preserve the mutation request and focus target until dismissal completes.
export type IMarkdownEditorYouTubeVideoDialogState =
  | {
      insertionRequest: IMarkdownEditorYouTubeVideoInsertionRequest;
      mode: 'add';
      resolveReturnFocusElement: () => HTMLElement | null;
    }
  | {
      descriptor: IYouTubeVideoDescriptor;
      editRequest: IMarkdownEditorYouTubeVideoEditRequest;
      mode: 'edit';
      resolveReturnFocusElement: () => HTMLElement | null;
    };

// current authoring behavior consumed by every mounted YouTube node view.
export type IMarkdownEditorYouTubeVideoAuthoringOptions = {
  isAuthoringEnabled: boolean;
  onEditRequest: (request: IMarkdownEditorYouTubeVideoEditRequest) => void;
};

// per-editor controller keeps node views synchronized without recreating their React roots.
export type IMarkdownEditorYouTubeVideoAuthoringController = {
  dispose: () => void;
  getOptions: () => IMarkdownEditorYouTubeVideoAuthoringOptions;
  subscribe: (listener: () => void) => () => void;
  update: (options: IMarkdownEditorYouTubeVideoAuthoringOptions) => void;
};

// controlled dialog props for add and edit authoring sessions.
export type IMarkdownEditorYouTubeVideoDialogProps = {
  initialDescriptor?: IYouTubeVideoDescriptor | undefined;
  mode: 'add' | 'edit';
  onClosed: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (descriptor: IYouTubeVideoDescriptor) => void;
  open: boolean;
  resolveReturnFocusElement: () => HTMLElement | null;
};

// pure React presentation props used by the ProseMirror node view.
export type IMarkdownEditorYouTubeVideoNodeViewProps = {
  descriptor: IYouTubeVideoDescriptor;
  isAuthoringEnabled: boolean;
  isSelected: boolean;
  onEdit: (triggerElement: HTMLButtonElement) => void;
};

// shared icon props keep the node-view glyph decorative by default.
export type IMarkdownEditorYouTubeVideoIconProps = Pick<
  React.ComponentProps<'svg'>,
  'aria-hidden' | 'className'
>;
