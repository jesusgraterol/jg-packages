// markdown ATX heading lines supported as section names
export const MARKDOWN_HEADING_PATTERN = /^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/;

// markdown fenced code block opening lines that should not be scanned for headings
export const FENCED_CODE_BLOCK_PATTERN = /^(`{3,}|~{3,})/;

// the media query that reports whether the user asked the system to reduce motion
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// the origins of the URLs toYouTubeWatchUrl and toYouTubeEmbedUrl build; embeds use YouTube's
// privacy-enhanced domain, which sets no cookies until the video plays
export const YOUTUBE_WATCH_ORIGIN = 'https://www.youtube.com';
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

// the hosts parseYouTubeVideoId accepts, by the paths each serves single videos on
export const YOUTUBE_SHORT_HOSTS: ReadonlySet<string> = new Set(['youtu.be', 'www.youtu.be']);
export const YOUTUBE_STANDARD_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
]);
export const YOUTUBE_MOBILE_HOSTS: ReadonlySet<string> = new Set(['m.youtube.com']);
export const YOUTUBE_NOCOOKIE_HOSTS: ReadonlySet<string> = new Set([
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

// the first path segments each host serves a single video under, as /<segment>/<id>
export const YOUTUBE_VIDEO_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  'shorts',
  'embed',
  'live',
]);
export const YOUTUBE_NOCOOKIE_PATH_SEGMENTS: ReadonlySet<string> = new Set(['embed']);

// the longest delay setTimeout accepts, 2^31 - 1 milliseconds; a longer cooldown waits in steps
export const MAX_TIMEOUT_MS = 2_147_483_647;
