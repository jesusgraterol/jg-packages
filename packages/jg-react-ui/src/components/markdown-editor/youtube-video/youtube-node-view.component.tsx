import { useCallback } from 'react';
import type * as React from 'react';
import { ExternalLinkIcon, PencilIcon } from 'lucide-react';

import { YouTubeVideo } from '../../youtube-video/index.js';
import { Button } from '../../button/index.js';

import { MARKDOWN_EDITOR_YOUTUBE_VIDEO_ICON_NODE } from './constants.js';
import type {
  IMarkdownEditorYouTubeVideoIconProps,
  IMarkdownEditorYouTubeVideoNodeViewProps,
} from './types.js';

/**
 * Renders the shared decorative video glyph from the same nodes used by Crepe.
 * @param props The SVG accessibility and class props.
 * @returns A compact outline video icon.
 */
const MarkdownEditorYouTubeVideoIcon = ({
  'aria-hidden': ariaHidden = true,
  className,
}: IMarkdownEditorYouTubeVideoIconProps): React.ReactElement => (
  <svg
    aria-hidden={ariaHidden}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    {MARKDOWN_EDITOR_YOUTUBE_VIDEO_ICON_NODE.map(([elementName, attributes]) => {
      const IconElement = elementName;

      return (
        <IconElement
          key={'d' in attributes ? attributes.d : `${elementName}-${attributes.x}`}
          {...attributes}
        />
      );
    })}
  </svg>
);

/**
 * Renders one selectable YouTube block inside ProseMirror.
 * @param props The validated descriptor, selection state, and guarded authoring callback.
 * @returns A responsive player with optional edit and open controls.
 */
export const MarkdownEditorYouTubeVideoNodeView = ({
  descriptor,
  isAuthoringEnabled,
  isSelected,
  onEdit,
}: IMarkdownEditorYouTubeVideoNodeViewProps): React.ReactElement => {
  /**
   * Sends the live edit button back to the owning ProseMirror node view.
   * @param event The edit button click event.
   */
  const handleEdit = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>): void => {
      onEdit(event.currentTarget);
    },
    [onEdit],
  );

  return (
    <div
      contentEditable={false}
      data-authoring-enabled={isAuthoringEnabled ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      data-slot="markdown-editor-youtube-video"
      className="border-border bg-background ring-offset-background data-[selected=true]:ring-foreground my-4 grid min-w-0 grid-cols-1 gap-2 rounded-xl border p-2 data-[selected=true]:ring-2 data-[selected=true]:ring-offset-2"
    >
      <div className="flex min-w-0 items-center justify-between gap-2 px-1">
        <span className="text-secondary-foreground flex min-w-0 items-center gap-2 text-sm font-medium">
          <MarkdownEditorYouTubeVideoIcon className="size-4 shrink-0" />
          <span className="truncate">{descriptor.title}</span>
        </span>

        {isAuthoringEnabled ? (
          <div
            aria-label="YouTube video actions"
            data-youtube-video-interactive="true"
            role="group"
            className="flex shrink-0 items-center gap-1"
          >
            <Button
              aria-label="Edit YouTube video"
              size="icon-touch"
              title="Edit YouTube video"
              type="button"
              variant="ghost"
              onClick={handleEdit}
            >
              <PencilIcon aria-hidden="true" />
            </Button>
            <Button
              asChild
              size="icon-touch"
              variant="ghost"
            >
              <a
                aria-label="Open on YouTube (opens in a new tab)"
                href={descriptor.watchUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="Open on YouTube"
              >
                <ExternalLinkIcon aria-hidden="true" />
              </a>
            </Button>
          </div>
        ) : null}
      </div>

      <div data-youtube-video-interactive="true">
        <YouTubeVideo
          title={descriptor.title}
          videoId={descriptor.videoId}
        />
      </div>
    </div>
  );
};
