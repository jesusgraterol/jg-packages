# jg-git-commands recipes

Patterns for Node.js code that reads Git repositories it may not own, and for scripts that check a checkout before they act on it.

## Reading a file at a pinned commit

Use this when the app reads a file from a repository someone else controls, at a commit a record pins, such as the `package.json` of a deployment. The app fetches only that commit into a bare repository it made, so no config but its own applies, and reads the file without checking anything out:

```ts
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { fetchCommit, readFileAtRevision, runGit } from 'jg-git-commands';

// the repository and the commit the deployment record pins, and where the app keeps its caches
declare const repositoryUrl: string;
declare const pinnedCommit: string;
declare const cacheDirectory: string;

// the options every command runs with: the user's global config never reaches a URL the app
// doesn't trust
const UNTRUSTED = { isolateConfig: true, timeoutSeconds: 60 };

export const readPinnedManifest = async (): Promise<unknown> => {
  // a URL the app doesn't trust could name a local path or another transport
  if (new URL(repositoryUrl).protocol !== 'https:') {
    throw new Error('Only HTTPS repositories can be read.');
  }

  // a bare repository the app made, so its config holds nothing the app didn't write; init is
  // safe to repeat on one that exists
  const cache = join(cacheDirectory, 'manifests.git');
  await mkdir(cache, { recursive: true });
  await runGit(['init', '--bare', '--quiet'], { cwd: cache, ...UNTRUSTED });

  // one commit, without its history, tags, hooks, or maintenance
  await fetchCommit(cache, repositoryUrl, pinnedCommit, UNTRUSTED);

  // a manifest larger than 64 KiB rejects with PROCESS_OUTPUT_TOO_LARGE
  const manifest = await readFileAtRevision(cache, pinnedCommit, 'package.json', {
    ...UNTRUSTED,
    maxBytes: 65_536,
  });
  return JSON.parse(manifest);
};
```

`fetchCommit` takes only a full object ID, so a record can't pin a branch that moves, and it throws `GIT_INVALID_ARGUMENT` for anything else. The remote must allow fetching a commit by its object ID, as GitHub does. A commit or a file the remote doesn't have throws `GIT_COMMAND_FAILED`, with the subcommand and the exit code in its data, but never Git's stderr, which can show the URL. For a private repository, pass a header through `env`, as the README's credentials section shows, rather than a token in the URL.

## Checking a checkout before a release script

Use this when a release script tags and publishes from a developer's checkout: it should stop before it starts when the checkout has uncommitted changes, isn't the commit `origin/main` points at, or the tag already exists on the remote:

```ts
import { isWorkingTreeClean, readRemoteRefs, resolveCommit } from 'jg-git-commands';

// why the checkout can't be released, or null when it can
type IReleaseBlocker = 'uncommitted-changes' | 'not-origin-main' | 'tag-exists' | null;

// the checkout the script runs in, and the tag it's about to create, such as 'v1.4.0'
declare const repositoryDirectory: string;
declare const tag: string;

export const findReleaseBlocker = async (): Promise<IReleaseBlocker> => {
  if (!(await isWorkingTreeClean(repositoryDirectory))) {
    return 'uncommitted-changes';
  }
  const head = await resolveCommit(repositoryDirectory, 'HEAD');

  // one round trip reads both refs; a ref the remote doesn't have is missing from the map
  const remote = await readRemoteRefs(
    repositoryDirectory,
    'origin',
    ['refs/heads/main', `refs/tags/${tag}`],
    { useCredentialHelpers: true, timeoutSeconds: 15 },
  );
  if (remote.get('refs/heads/main') !== head) {
    return 'not-origin-main';
  }
  return remote.has(`refs/tags/${tag}`) ? 'tag-exists' : null;
};
```

The checkout is the developer's own, so their global config applies, such as an SSH host alias, and `useCredentialHelpers` lets an HTTPS remote use the credentials their helper stores. Without stored credentials, the command fails at once with `GIT_COMMAND_FAILED` instead of prompting. `isWorkingTreeClean` counts untracked files that aren't ignored, even when `status.showUntrackedFiles` hides them, because a build can pick them up.
