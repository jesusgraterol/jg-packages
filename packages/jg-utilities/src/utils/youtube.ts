import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { isYouTubeVideoIdValid } from '../validations/index.js';

import {
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_MOBILE_HOSTS,
  YOUTUBE_NOCOOKIE_HOSTS,
  YOUTUBE_NOCOOKIE_PATH_SEGMENTS,
  YOUTUBE_SHORT_HOSTS,
  YOUTUBE_STANDARD_HOSTS,
  YOUTUBE_VIDEO_PATH_SEGMENTS,
  YOUTUBE_WATCH_ORIGIN,
} from './constants.js';

/**
 * Reads the video id of a watch page: the path is exactly `/watch`, with exactly one `v`.
 * @param url The parsed URL.
 * @returns The id candidate, or undefined.
 */
const readWatchVideoId = (url: URL): string | undefined => {
  const videoIds = url.searchParams.getAll('v');
  return url.pathname === '/watch' && videoIds.length === 1 ? videoIds[0] : undefined;
};

/**
 * Reads the id from a path of exactly two segments, `/<segment>/<id>`, when the first is allowed.
 * @param url The parsed URL.
 * @param segments The first segments the host serves videos under.
 * @returns The id candidate, or undefined.
 */
const readSegmentVideoId = (url: URL, segments: ReadonlySet<string>): string | undefined => {
  const [, segment = '', videoId, ...rest] = url.pathname.split('/');
  return segments.has(segment) && rest.length === 0 ? videoId : undefined;
};

/**
 * Reads the id candidate a YouTube URL points at, by its host's supported paths.
 * @param url The parsed URL, https with no credentials or port.
 * @returns The id candidate, or undefined when the host or path isn't a single video's.
 */
const readVideoIdCandidate = (url: URL): string | undefined => {
  const host = url.hostname;
  if (YOUTUBE_SHORT_HOSTS.has(host)) {
    const [, videoId, ...rest] = url.pathname.split('/');
    return rest.length === 0 ? videoId : undefined;
  }
  if (YOUTUBE_STANDARD_HOSTS.has(host)) {
    return readWatchVideoId(url) ?? readSegmentVideoId(url, YOUTUBE_VIDEO_PATH_SEGMENTS);
  }
  if (YOUTUBE_MOBILE_HOSTS.has(host)) {
    return readWatchVideoId(url);
  }
  if (YOUTUBE_NOCOOKIE_HOSTS.has(host)) {
    return readSegmentVideoId(url, YOUTUBE_NOCOOKIE_PATH_SEGMENTS);
  }
  return undefined;
};

/**
 * Reads the id of the single YouTube video a URL points at, such as one a user pasted. It accepts
 * https URLs without credentials or a port, on these hosts and paths, and ignores the query, apart
 * from `v`, and the hash:
 * - `youtu.be/<id>`
 * - `youtube.com/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>`, and `/live/<id>`
 * - `m.youtube.com/watch?v=<id>`
 * - `youtube-nocookie.com/embed/<id>`
 *
 * The `www.` form of each host works too. Anything else, such as a playlist, a channel, or a value
 * that isn't a URL, returns null rather than throwing.
 * @param url The value to read, trimmed when it's a string.
 * @returns The 11-character video id, or null.
 * @example
 * import { parseYouTubeVideoId } from 'jg-utilities';
 *
 * parseYouTubeVideoId('https://youtu.be/M7lc1UVf-VE'); // => 'M7lc1UVf-VE'
 * parseYouTubeVideoId('https://www.youtube.com/watch?v=M7lc1UVf-VE&t=30'); // => 'M7lc1UVf-VE'
 * parseYouTubeVideoId('https://www.youtube.com/playlist?list=PL123'); // => null
 */
export const parseYouTubeVideoId = (url: unknown): string | null => {
  if (typeof url !== 'string' || url.trim() === '') {
    return null;
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return null;
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.port !== ''
  ) {
    return null;
  }
  const videoId = readVideoIdCandidate(parsedUrl);
  return isYouTubeVideoIdValid(videoId) ? videoId : null;
};

/**
 * Checks a video id before it's put into a URL.
 * @param videoId The id.
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
const assertVideoId = (videoId: string): void => {
  if (!isYouTubeVideoIdValid(videoId)) {
    throw new Exception("The YouTube video id must be 11 letters, digits, '-', or '_'.", {
      code: ERRORS.INVALID_YOUTUBE_VIDEO_ID,
      data: { videoId: String(videoId) },
    });
  }
};

/**
 * Builds the canonical watch page URL of a YouTube video, such as for a link.
 * @param videoId The video id, such as one parseYouTubeVideoId read.
 * @returns The URL, `https://www.youtube.com/watch?v=<id>`.
 * @example
 * import { toYouTubeWatchUrl } from 'jg-utilities';
 *
 * toYouTubeWatchUrl('M7lc1UVf-VE'); // => 'https://www.youtube.com/watch?v=M7lc1UVf-VE'
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
export const toYouTubeWatchUrl = (videoId: string): string => {
  assertVideoId(videoId);
  return `${YOUTUBE_WATCH_ORIGIN}/watch?v=${videoId}`;
};

/**
 * Builds the URL that embeds a YouTube video in an iframe, on YouTube's privacy-enhanced domain,
 * which sets no cookies until the video plays.
 * @param videoId The video id, such as one parseYouTubeVideoId read.
 * @returns The URL, `https://www.youtube-nocookie.com/embed/<id>`.
 * @example
 * import { toYouTubeEmbedUrl } from 'jg-utilities';
 *
 * toYouTubeEmbedUrl('M7lc1UVf-VE'); // => 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
export const toYouTubeEmbedUrl = (videoId: string): string => {
  assertVideoId(videoId);
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}`;
};
