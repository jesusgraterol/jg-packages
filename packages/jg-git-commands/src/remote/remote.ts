import type { IRemoteRepository } from './types.js';

/*
 * The remote URLs a hosted repository has, such as on GitHub: `git@<host>:<owner>/<name>`,
 * `ssh://git@<host>[:port]/<owner>/<name>` and `https://<host>/<owner>/<name>`, with or without
 * `.git`. Neither the owner nor the name holds a slash or whitespace, and HTTPS carries no user.
 */
const REMOTE_PATTERN =
  /^(?:[^\s:/@]+@[^\s:/@]+:|ssh:\/\/[^\s:/@]+@[^\s:/@]+(?::\d+)?\/|https:\/\/[^\s:/@]+(?::\d+)?\/)([^\s/]+)\/([^\s/]+?)(?:\.git)?\/?$/;

/**
 * Reads a hosted repository's owner and name from its remote URL, such as the `jesusgraterol` and
 * `jg-packages` of `git@github.com:jesusgraterol/jg-packages.git`, from the SCP-like SSH form, an
 * `ssh://` URL or an HTTPS URL, with or without `.git`. It reaches no remote.
 * @param url The remote's URL, such as `getRemoteUrl` reads.
 * @returns The owner and name, or null for a URL of another form, such as a local path, a URL
 * with nested groups, or one carrying credentials.
 * @example
 * import { parseRemoteRepository } from 'jg-git-commands';
 *
 * parseRemoteRepository('git@github.com:jesusgraterol/jg-packages.git'); // { owner: 'jesusgraterol', name: 'jg-packages' }
 * parseRemoteRepository('https://github.com/jesusgraterol/jg-packages'); // { owner: 'jesusgraterol', name: 'jg-packages' }
 * parseRemoteRepository('../jg-packages'); // null
 */
export const parseRemoteRepository = (url: string): IRemoteRepository | null => {
  const match = REMOTE_PATTERN.exec(url);
  const owner = match?.[1];
  const name = match?.[2];
  // `.git` alone is the suffix of a URL without a name, never a repository's name
  return owner && name && name !== '.git' ? { owner, name } : null;
};
