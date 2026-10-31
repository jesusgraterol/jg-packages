import { describe, expect, test } from 'vitest';

import { createYouTubeVideoEmbedUrl, parseYouTubeVideoUrl } from './index.js';

const VIDEO_ID = 'M7lc1UVf-VE';
const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const EMBED_URL = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`;

describe('YouTube video URL utilities', () => {
  test.each([
    [undefined, EMBED_URL],
    [false, EMBED_URL],
    [true, `${EMBED_URL}?autoplay=1`],
  ])('createYouTubeVideoEmbedUrl(autoPlay=%s) -> %s', (autoPlay, expectedUrl) => {
    const descriptor = parseYouTubeVideoUrl(WATCH_URL);

    expect(descriptor).not.toBeNull();
    if (descriptor === null) return;

    expect(createYouTubeVideoEmbedUrl(descriptor.videoId, autoPlay)).toBe(expectedUrl);
    expect(descriptor.embedUrl).toBe(EMBED_URL);
  });

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
    `https://youtube-nocookie.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
  ])('parseYouTubeVideoUrl(%s) -> canonical descriptor', (sourceUrl) => {
    expect(parseYouTubeVideoUrl(sourceUrl, 'Product walkthrough')).toStrictEqual({
      videoId: VIDEO_ID,
      watchUrl: WATCH_URL,
      embedUrl: EMBED_URL,
      title: 'Product walkthrough',
    });
  });

  test('trims input and discards all authored query and hash context', () => {
    expect(
      parseYouTubeVideoUrl(
        `  https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123&t=30&autoplay=1#details  `,
        '  Release walkthrough  ',
      ),
    ).toStrictEqual({
      videoId: VIDEO_ID,
      watchUrl: WATCH_URL,
      embedUrl: EMBED_URL,
      title: 'Release walkthrough',
    });
  });

  test.each([
    [undefined, 'YouTube video'],
    ['', 'YouTube video'],
    ['   ', 'YouTube video'],
    [`https://youtu.be/${VIDEO_ID}`, 'YouTube video'],
    [`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`, 'YouTube video'],
    ['  Product walkthrough  ', 'Product walkthrough'],
  ])('normalizes the title %o -> %s', (title, expectedTitle) => {
    expect(parseYouTubeVideoUrl(`https://youtu.be/${VIDEO_ID}`, title)?.title).toBe(expectedTitle);
  });

  test.each([
    null,
    undefined,
    42,
    {},
    '',
    'not a URL',
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    `ftp://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.example/watch?v=${VIDEO_ID}`,
    `https://youtube.com.example/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://youtube.com@www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com:444/watch?v=${VIDEO_ID}`,
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com/watch?v=${VIDEO_ID}x`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&v=abcdefghijk`,
    `https://www.youtube.com/watch/${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}/extra`,
    `https://www.youtube.com/shorts/${VIDEO_ID}/extra`,
    `https://www.youtube.com/embed/${VIDEO_ID}/extra`,
    `https://m.youtube.com/shorts/${VIDEO_ID}`,
    `https://m.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/watch?v=${VIDEO_ID}`,
    'https://www.youtube.com/playlist?list=PL123',
    'https://vimeo.com/123456789',
  ])('parseYouTubeVideoUrl(%o) -> null', (sourceUrl) => {
    expect(parseYouTubeVideoUrl(sourceUrl)).toBeNull();
  });
});

test('the UI does not broaden supported routes to live streams', () => {
  expect(parseYouTubeVideoUrl('https://www.youtube.com/live/M7lc1UVf-VE')).toBeNull();
});
