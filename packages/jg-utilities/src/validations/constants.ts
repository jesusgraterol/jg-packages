// the maximum length for an email address according to the standard (RFC 5321)
export const MAX_EMAIL_LENGTH = 320;

// the default maximum size of a file name in UTF-8 bytes (ext4, APFS and NTFS all allow 255)
export const MAX_FILE_NAME_BYTES = 255;

// characters that Windows or POSIX forbid in a file name, including control characters
// eslint-disable-next-line no-control-regex
export const FILE_NAME_FORBIDDEN_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F\u007F]/;

// names Windows reserves for devices, with or without an extension; Windows reads the superscript
// digits ¹, ², and ³ as digits in these names
export const WINDOWS_RESERVED_FILE_NAME = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i;

// a YouTube video id: 11 characters of the base64url alphabet
export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
