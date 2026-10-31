import { parseYouTubeVideoId, toYouTubeEmbedUrl, toYouTubeWatchUrl } from 'jg-utilities';

import type { IYouTubeVideoDescriptor, IYouTubeVideoId } from './types.js';

/** Reads a supported video while retaining the source UI's narrower single-video routes. */
const parseYouTubeVideoSource = (sourceUrl: unknown): IYouTubeVideoId | null => {
  const videoId = parseYouTubeVideoId(sourceUrl);
  if (videoId === null || typeof sourceUrl !== 'string') return null;
  // jg-utilities also accepts /live; the retained UI contract intentionally does not.
  if (new URL(sourceUrl.trim()).pathname.startsWith('/live/')) return null;
  return videoId as IYouTubeVideoId;
};

/**
 * Builds the canonical public watch URL for a validated video.
 * @param videoId The validated identifier.
 * @returns The canonical watch URL.
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
export const createYouTubeVideoWatchUrl = (videoId: IYouTubeVideoId): string =>
  toYouTubeWatchUrl(videoId);

/**
 * Builds the fixed-origin privacy-enhanced player URL.
 * @param videoId The validated identifier.
 * @param autoPlay Whether playback was explicitly requested.
 * @returns The embed URL without authored query parameters.
 * @throws
 * - INVALID_YOUTUBE_VIDEO_ID: The YouTube video id must be 11 letters, digits, '-', or '_'.
 */
export const createYouTubeVideoEmbedUrl = (videoId: IYouTubeVideoId, autoPlay = false): string =>
  `${toYouTubeEmbedUrl(videoId)}${autoPlay ? '?autoplay=1' : ''}`;

/** Resolves authored labels without presenting a redundant URL as the iframe title. */
export const normalizeYouTubeVideoTitle = (title: unknown, videoId: IYouTubeVideoId): string => {
  if (typeof title !== 'string' || title.trim() === '') return 'YouTube video';
  const normalizedTitle = title.trim();
  return parseYouTubeVideoSource(normalizedTitle) === videoId ? 'YouTube video' : normalizedTitle;
};

/**
 * Parses an authored URL into the retained single-video descriptor.
 * @param sourceUrl The URL candidate.
 * @param title An optional plain-text label.
 * @returns A validated descriptor, or null for unsupported input.
 * @example
 * import { parseYouTubeVideoUrl } from 'jg-react-ui/components/youtube-video';
 * const video = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE', 'Walkthrough');
 */
export const parseYouTubeVideoUrl = (
  sourceUrl: unknown,
  title?: unknown,
): IYouTubeVideoDescriptor | null => {
  const videoId = parseYouTubeVideoSource(sourceUrl);
  if (!videoId) return null;
  return {
    videoId,
    watchUrl: createYouTubeVideoWatchUrl(videoId),
    embedUrl: createYouTubeVideoEmbedUrl(videoId),
    title: normalizeYouTubeVideoTitle(title, videoId),
  };
};
