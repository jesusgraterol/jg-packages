import type { IYouTubeVideoId } from '../../shared/youtube-video/index.js';

/** Props for the fixed-origin responsive YouTube player.
 * @see YouTubeVideo
 */
export type IYouTubeVideoProps = {
  videoId: IYouTubeVideoId;
  title: string;
  className?: string | undefined;
  // autoplay is opt-in and remains subject to the browser's playback policy.
  autoPlay?: boolean | undefined;
};
