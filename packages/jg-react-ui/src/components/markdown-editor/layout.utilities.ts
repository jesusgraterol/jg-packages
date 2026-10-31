import { MARKDOWN_EDITOR_LAYOUTS, MARKDOWN_EDITOR_WIDE_MIN_WIDTH_PX } from './constants.js';
import type { IResolvedMarkdownEditorLayout } from './types.js';

/**
 * Resolves the editor layout that fits the available container width.
 * @param width The measured container width in CSS pixels.
 * @returns The compact or wide editor layout.
 */
export const getMarkdownEditorLayoutForWidth = (width: number): IResolvedMarkdownEditorLayout =>
  width >= MARKDOWN_EDITOR_WIDE_MIN_WIDTH_PX
    ? MARKDOWN_EDITOR_LAYOUTS.Wide
    : MARKDOWN_EDITOR_LAYOUTS.Compact;
