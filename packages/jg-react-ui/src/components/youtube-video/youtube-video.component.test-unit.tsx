import { renderToStaticMarkup } from 'react-dom/server';
import { expectToThrowCode } from 'jg-exception/testing';
import { test } from 'vitest';

import { YouTubeVideo, type IYouTubeVideoId } from './index.js';

test('a forged player identifier exposes the canonical dependency error', () => {
  expectToThrowCode(
    () =>
      renderToStaticMarkup(
        <YouTubeVideo
          title="Invalid video"
          videoId={'../watch' as IYouTubeVideoId}
        />,
      ),
    'INVALID_YOUTUBE_VIDEO_ID',
    "The YouTube video id must be 11 letters, digits, '-', or '_'.",
  );
});
