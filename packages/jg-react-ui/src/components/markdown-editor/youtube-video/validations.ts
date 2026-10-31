import { z } from 'zod';

import { parseYouTubeVideoUrl } from '../../../shared/youtube-video/index.js';

import { MARKDOWN_EDITOR_YOUTUBE_VIDEO_URL_ERROR } from './constants.js';

// YouTube dialog validation converts authored fields into the canonical video descriptor.
export const MarkdownEditorYouTubeVideoFormSchema = z
  .strictObject({
    youtubeVideoTitle: z.string(),
    youtubeVideoUrl: z.string(),
  })
  .transform((formValues, context) => {
    const descriptor = parseYouTubeVideoUrl(
      formValues.youtubeVideoUrl,
      formValues.youtubeVideoTitle,
    );

    if (descriptor === null) {
      context.addIssue({
        code: 'custom',
        message: MARKDOWN_EDITOR_YOUTUBE_VIDEO_URL_ERROR,
        path: ['youtubeVideoUrl'],
      });

      return z.NEVER;
    }

    return descriptor;
  });
