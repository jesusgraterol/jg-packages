// types
export type {
  IMarkdownEditorYouTubeVideoAuthoringController,
  IMarkdownEditorYouTubeVideoAuthoringOptions,
  IMarkdownEditorYouTubeVideoDialogProps,
  IMarkdownEditorYouTubeVideoDialogState,
  IMarkdownEditorYouTubeVideoEditRequest,
  IMarkdownEditorYouTubeVideoInsertionRequest,
  IMarkdownEditorYouTubeVideoNodeAttributes,
  IMarkdownEditorYouTubeVideoNodeViewProps,
} from './types.js';

// constants
export {
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_ICON_NODE,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_KEY,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_LABEL,
} from './constants.js';

// components
export { MarkdownEditorYouTubeVideoDialog } from './markdown-editor-youtube-video-dialog.component.js';

// Milkdown integration
export {
  configureMarkdownEditorYouTubeVideoAuthoring,
  createMarkdownEditorYouTubeVideoAuthoringController,
  createMarkdownEditorYouTubeVideoInsertionRequest,
  insertMarkdownEditorYouTubeVideo,
  markdownEditorYouTubeVideoPlugin,
  markdownEditorYouTubeVideoSchema,
  updateMarkdownEditorYouTubeVideo,
} from './markdown-editor-youtube-video.plugin.js';
