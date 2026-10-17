// markdown ATX heading lines supported as section names
export const MARKDOWN_HEADING_PATTERN = /^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/;

// markdown fenced code block opening lines that should not be scanned for headings
export const FENCED_CODE_BLOCK_PATTERN = /^(`{3,}|~{3,})/;

// the media query that reports whether the user asked the system to reduce motion
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
