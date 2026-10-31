import type * as React from 'react';
import { cn } from 'cnfast';

import { createYouTubeVideoEmbedUrl } from '../../shared/youtube-video/index.js';

import type { IYouTubeVideoProps } from './types.js';

// permissions required for protected playback and user-initiated picture-in-picture.
const YOUTUBE_VIDEO_IFRAME_PERMISSIONS = 'encrypted-media; picture-in-picture';
const YOUTUBE_VIDEO_AUTOPLAY_IFRAME_PERMISSIONS = `autoplay; ${YOUTUBE_VIDEO_IFRAME_PERMISSIONS}`;

/**
 * Renders a validated YouTube video through the privacy-enhanced player origin.
 * @param props The validated video identifier, title, optional autoplay request and wrapper classes.
 * @returns A responsive, lazy-loaded YouTube iframe.
 * @example
 * import { createElement } from 'react';
 * import { parseYouTubeVideoUrl, YouTubeVideo } from 'jg-react-ui/components/youtube-video';
 * const video = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE', 'Walkthrough');
 * const example = video ? createElement(YouTubeVideo, { videoId: video.videoId, title: video.title }) : null;
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
export const YouTubeVideo = ({
  autoPlay = false,
  className,
  title,
  videoId,
}: IYouTubeVideoProps): React.ReactElement => (
  <div
    data-slot="youtube-video"
    className={cn(
      'border-border bg-background shadow-surface focus-within:ring-foreground focus-within:ring-offset-background aspect-video min-h-50 w-full min-w-0 overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-offset-2',
      className,
    )}
  >
    <iframe
      allow={
        autoPlay ? YOUTUBE_VIDEO_AUTOPLAY_IFRAME_PERMISSIONS : YOUTUBE_VIDEO_IFRAME_PERMISSIONS
      }
      allowFullScreen
      className="block h-full min-h-50 w-full border-0 outline-none"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      src={createYouTubeVideoEmbedUrl(videoId, autoPlay)}
      title={title}
    />
  </div>
);
