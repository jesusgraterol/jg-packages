import {
  MARKDOWN_EDITOR_ALL_TOOLS,
  MARKDOWN_EDITOR_TOOLBAR_ACTIONS,
  MARKDOWN_EDITOR_TURN_INTO_OPTIONS,
} from './constants.js';
import type { IMarkdownEditorTool, IMarkdownEditorTurnIntoOption } from './types.js';

// toolbar action metadata that can be filtered by the editor tool policy.
export type IMarkdownEditorToolbarAction = (typeof MARKDOWN_EDITOR_TOOLBAR_ACTIONS)[number];

/**
 * Returns true when at least one candidate tool is enabled.
 * @param supportedToolSet The enabled editor tools.
 * @param tools The tools to inspect.
 * @returns True when any candidate tool is supported.
 */
export const hasAnyMarkdownEditorTool = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
  tools: ReadonlyArray<IMarkdownEditorTool>,
): boolean => tools.some((tool) => supportedToolSet.has(tool));

/**
 * Builds the normalized tool set for an editor instance.
 * @param supportedTools The optional public tool policy.
 * @returns The enabled editor tools, or every tool when no policy is provided.
 */
export const getMarkdownEditorSupportedToolSet = (
  supportedTools: ReadonlyArray<IMarkdownEditorTool> = MARKDOWN_EDITOR_ALL_TOOLS,
): ReadonlySet<IMarkdownEditorTool> => new Set(supportedTools);

/**
 * Builds a stable key used to remount Crepe when supported tools change.
 * @param supportedTools The optional public tool policy.
 * @returns A stable key for the enabled tool set.
 */
export const getMarkdownEditorSupportedToolsKey = (
  supportedTools: ReadonlyArray<IMarkdownEditorTool> = MARKDOWN_EDITOR_ALL_TOOLS,
): string => [...getMarkdownEditorSupportedToolSet(supportedTools)].sort().join(',');

/**
 * Returns the floating toolbar actions enabled by a normalized tool set.
 * @param supportedToolSet The enabled editor tools.
 * @returns The visible native toolbar actions in rendered order.
 */
export const getVisibleMarkdownEditorToolbarActionsFromSet = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
): ReadonlyArray<IMarkdownEditorToolbarAction> =>
  MARKDOWN_EDITOR_TOOLBAR_ACTIONS.filter((action) => supportedToolSet.has(action.tool));

/**
 * Returns the floating toolbar actions enabled by the public tool policy.
 * @param supportedTools The optional public tool policy.
 * @returns The visible native toolbar actions in rendered order.
 */
export const getVisibleMarkdownEditorToolbarActions = (
  supportedTools: ReadonlyArray<IMarkdownEditorTool> = MARKDOWN_EDITOR_ALL_TOOLS,
): ReadonlyArray<IMarkdownEditorToolbarAction> =>
  getVisibleMarkdownEditorToolbarActionsFromSet(getMarkdownEditorSupportedToolSet(supportedTools));

/**
 * Filters turn-into options by the active tool policy.
 * @param supportedTools The enabled editor tools.
 * @returns The options available in the block action menu.
 */
export const getVisibleMarkdownEditorTurnIntoOptions = (
  supportedTools: ReadonlyArray<IMarkdownEditorTool> = MARKDOWN_EDITOR_ALL_TOOLS,
): ReadonlyArray<IMarkdownEditorTurnIntoOption> => {
  const supportedToolSet = getMarkdownEditorSupportedToolSet(supportedTools);

  return MARKDOWN_EDITOR_TURN_INTO_OPTIONS.filter((option) => supportedToolSet.has(option.tool));
};
