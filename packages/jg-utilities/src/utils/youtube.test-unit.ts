// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { parseYouTubeVideoId, toYouTubeEmbedUrl, toYouTubeWatchUrl } from './youtube.js';

const VIDEO_ID = 'M7lc1UVf-VE';

describe('parseYouTubeVideoId', () => {
  test.each([
    `https://youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}`,
    `https://www.youtu.be/${VIDEO_ID}`,
    `https://youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://youtube-nocookie.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `https://WWW.YouTube.com/watch?v=${VIDEO_ID}`,
  ])('parseYouTubeVideoId(%s) -> the id', (url) => {
    expect(parseYouTubeVideoId(url)).toBe(VIDEO_ID);
  });

  test('trims the value and ignores the rest of the query and the hash', () => {
    expect(
      parseYouTubeVideoId(
        `  https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123&t=30&autoplay=1#details  `,
      ),
    ).toBe(VIDEO_ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${VIDEO_ID}?si=abc#t=1`)).toBe(VIDEO_ID);
  });

  test.each([
    null,
    undefined,
    42,
    {},
    '',
    '   ',
    'not a URL',
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    `ftp://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.example/watch?v=${VIDEO_ID}`,
    `https://youtube.com.example/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://youtube.com@www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://user:pass@www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com:444/watch?v=${VIDEO_ID}`,
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com/watch?v=${VIDEO_ID}x`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&v=abcdefghijk`,
    `https://www.youtube.com/watch/${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}/extra`,
    `https://youtu.be/${VIDEO_ID}/`,
    'https://youtu.be/',
    `https://www.youtube.com/shorts/${VIDEO_ID}/extra`,
    `https://www.youtube.com/embed/${VIDEO_ID}/extra`,
    `https://www.youtube.com/embed/${VIDEO_ID}/`,
    `https://m.youtube.com/shorts/${VIDEO_ID}`,
    `https://m.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/live/${VIDEO_ID}`,
    'https://www.youtube.com/playlist?list=PL123',
    'https://vimeo.com/123456789',
  ])('parseYouTubeVideoId(%o) -> null', (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});

describe('toYouTubeWatchUrl', () => {
  test('builds the canonical watch page URL', () => {
    expect(toYouTubeWatchUrl(VIDEO_ID)).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
  });

  test.each(['', 'short', `${VIDEO_ID}x`, 'M7lc1UVf VE', 'M7lc1UVf&VE'])(
    'rejects the id %j',
    (videoId) => {
      expectToThrowCode(
        () => toYouTubeWatchUrl(videoId),
        ERRORS.INVALID_YOUTUBE_VIDEO_ID,
        "The YouTube video id must be 11 letters, digits, '-', or '_'.",
      );
    },
  );
});

describe('toYouTubeEmbedUrl', () => {
  test('builds the privacy-enhanced embed URL', () => {
    expect(toYouTubeEmbedUrl(VIDEO_ID)).toBe(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`);
  });

  test('rejects an id that could change the URL', () => {
    expectToThrowCode(
      () => toYouTubeEmbedUrl('../../watch'),
      ERRORS.INVALID_YOUTUBE_VIDEO_ID,
      "The YouTube video id must be 11 letters, digits, '-', or '_'.",
    );
  });
});
