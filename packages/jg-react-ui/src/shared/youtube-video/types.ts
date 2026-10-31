declare const YOUTUBE_VIDEO_ID_TYPE: unique symbol;

/** Validated identifier accepted by the fixed-origin player.
 * @see YouTubeVideo
 */
export type IYouTubeVideoId = string & {
  [YOUTUBE_VIDEO_ID_TYPE]: true;
};

/** Canonical video URLs and accessible title.
 * @see parseYouTubeVideoUrl
 */
export type IYouTubeVideoDescriptor = {
  videoId: IYouTubeVideoId;
  watchUrl: string;
  embedUrl: string;
  title: string;
};
