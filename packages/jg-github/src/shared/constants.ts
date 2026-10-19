// the origin of GitHub's REST API on github.com
export const GITHUB_API_ORIGIN = 'https://api.github.com';

// the origin GitHub serves a repository's raw files from
export const GITHUB_RAW_CONTENT_ORIGIN = 'https://raw.githubusercontent.com';

// the REST API version every request asks for, in the X-GitHub-Api-Version header
export const GITHUB_API_VERSION = '2026-03-10';

// the media type GitHub's REST API answers with
export const GITHUB_MEDIA_TYPE = 'application/vnd.github+json';

// the seconds a request to GitHub may take when the options don't say
export const DEFAULT_GITHUB_TIMEOUT_SECONDS = 10;

// the bytes a response from GitHub may take when the options don't say (128 KiB)
export const DEFAULT_GITHUB_MAX_RESPONSE_BYTES = 131_072;

// the host names that only this machine can reach, where plain http is allowed for test servers
export const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
