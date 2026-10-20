# jg-git-commands

Git commands for Node.js that never prompt or inherit Git environment variables, with time and output limits and typed reads.

## Install

```bash
npm install jg-git-commands
```

Git 2.32 or later must be on the `PATH`.

## Usage

Read a repository with typed helpers. Each runs `git` without a shell and without prompting, puts `--end-of-options` before the values you pass, and throws a classified error when the command fails:

```ts
import {
  isWorkingTreeClean,
  readFileAtRevision,
  readRemoteRefs,
  resolveCommit,
} from 'jg-git-commands';

const head = await resolveCommit('/srv/app', 'HEAD'); // the commit's full object ID, or null
const manifest = await readFileAtRevision('/srv/app', 'HEAD', 'package.json', { maxBytes: 65_536 }); // null without the file
const isClean = await isWorkingTreeClean('/srv/app');
const remote = await readRemoteRefs('/srv/app', 'origin', ['refs/heads/main']); // Map { 'refs/heads/main' => '…' }
```

`readStatus` gives the commit HEAD points at, null before the first one, and each changed path with its two status letters and, for a rename or a copy, its original path, from `git status --porcelain=v2`. `getRemoteUrl` reads a remote's URL, and `fetchCommit` fetches one commit by its object ID, at depth 1 by default, without tags, hooks, or automatic maintenance.

Read paths, the index, and the config as typed values. The readers of paths run with `-z` and refuse a path that isn't valid UTF-8 with `GIT_OUTPUT_INVALID`, instead of returning a mangled one. `readIndexEntries` and `listUntrackedFiles` also refuse a listing Git warned about, such as one that left out a directory it couldn't open, instead of returning an incomplete list:

```ts
import {
  listUntrackedFiles,
  readChangedPaths,
  readConfigBoolean,
  readGitVersion,
  readIndexEntries,
  readTopLevel,
} from 'jg-git-commands';

const root = await readTopLevel('/srv/app/src'); // '/srv/app', null inside .git or a bare repository
const changed = await readChangedPaths('/srv/app', 'origin/main', { to: 'HEAD' }); // ['src/index.ts']
const entries = await readIndexEntries('/srv/app'); // [{ mode: '100644', stage: 0, path: 'README.md' }]
const untracked = await listUntrackedFiles('/srv/app', { paths: ['docs'] });
const hasSymlinks = await readConfigBoolean('/srv/app', 'core.symlinks', true);
const { major, minor } = await readGitVersion('/srv/app'); // also reads suffixes such as .windows.1
```

Run any other command with `runGit`, which resolves with the exit code, whatever it is, and the output, as bytes with `encoding: 'buffer'`. `assertGitSucceeded` throws the same classified errors as the typed helpers:

```ts
import { assertGitSucceeded, runGit } from 'jg-git-commands';

const result = await runGit(['log', '-1', '--format=%s'], { cwd: '/srv/app', timeoutSeconds: 10 });
assertGitSucceeded(result, 'log');
```

`calculateGitBlobObjectId(content, { algorithm })` gives the object ID `git hash-object` would, for SHA-1 or SHA-256 repositories, without running Git.

### What every command runs with

- `GIT_TERMINAL_PROMPT=0`, so it never waits at a terminal.
- An empty `GIT_ASKPASS` and `-c core.askPass=`, so no askpass program runs, whether `GIT_ASKPASS`, `core.askPass`, or `SSH_ASKPASS` names one.
- `-c credential.helper=`, unless `useCredentialHelpers` is set, which empties the helper list from every config, the repository's included.
- `GIT_SSH_COMMAND=ssh -o BatchMode=yes -o ConnectTimeout=10`, which overrides `core.sshCommand`, so SSH never asks for a password or a passphrase either.
- None of the inherited `GIT_*` variables, such as `GIT_DIR`, `GIT_WORK_TREE`, or `GIT_CONFIG_PARAMETERS`, nor `SSH_ASKPASS`, in any case, since Windows reads `git_dir` as `GIT_DIR`. Pass the ones you need, such as `GIT_SSL_CAINFO`, in `env`, which ignores `GIT_ASKPASS`, `GIT_TERMINAL_PROMPT`, and `SSH_ASKPASS`, in any case too, so nothing passed there turns a prompt back on.
- No file system monitor, no pager, no colors, and no recursing into submodules, whatever the config says, and `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_NO_LAZY_FETCH=1`, and `GIT_LITERAL_PATHSPECS=1`.
- The C locale, `LC_ALL=C`, `LANG=C`, and `LANGUAGE=C`, so Git writes its messages in English and a failure can be classified.
- No transport, with an empty `GIT_ALLOW_PROTOCOL`, so no command reaches another repository unless you allow it. `readRemoteRefs` and `fetchCommit` allow HTTPS and SSH by default; pass `GIT_ALLOW_PROTOCOL` in `env` for others, such as `file` for a local remote.
- A 30-second timeout and a 1 MiB output limit, which reject with jg-process's `PROCESS_TIMED_OUT` and `PROCESS_OUTPUT_TOO_LARGE`, after stopping the command and everything it started.

### Partial clones never fetch while reading

In a partial clone, Git fetches a missing object from the remote the moment a command reads it, which turns a read into a network request to whatever the repository's config names. `GIT_NO_LAZY_FETCH=1` stops that, but only Git 2.45 and later, and the 2.39.4 to 2.44.1 security releases, honor it. The empty `GIT_ALLOW_PROTOCOL` stops it on every version, even when the repository's own config sets `protocol.file.allow=always`, so a read of a missing object fails instead. Git 2.32 or later is required.

### Credentials

Without credential helpers, a remote that asks for credentials fails at once. Authenticate with SSH keys that need no passphrase prompt, such as a deploy key or an agent, or pass the credentials yourself. A token in the URL shows up in the process listing, which other users on the machine can read. A header passed as config in `env` doesn't:

```ts
import { readRemoteRefs } from 'jg-git-commands';

declare const token: string;

const refs = await readRemoteRefs(
  '/srv/app',
  'https://github.com/acme/app.git',
  ['refs/heads/main'],
  {
    env: {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.extraHeader',
      GIT_CONFIG_VALUE_0: `Authorization: Bearer ${token}`,
    },
  },
);
```

With `useCredentialHelpers: true`, the configured helpers answer, still without an askpass program or a terminal. A helper you opt into, such as Git Credential Manager, may still prompt through its own window.

### Trust boundary

jg-git-commands stops prompts and ignores inherited Git environment variables. It doesn't make Git safe for repositories or URLs you don't trust on its own:

- **Global and system config** apply unless you pass `isolateConfig: true`. They can attach a stored header to every request (`http.extraHeader`), rewrite URLs (`url.<base>.insteadOf`), route requests through a proxy (`http.proxy`), include other files (`include.path`), and allow other transports (`protocol.<name>.allow`). Code that handles repositories or URLs it doesn't trust passes `isolateConfig: true`.
- **Repository config** can still run programs, so jg-git-commands isn't a sandbox for a repository whose config you don't trust:
  - `readStatus` and `isWorkingTreeClean`: `git status` runs the `filter.<driver>.clean` programs that `.gitattributes` and the config name.
  - `readRemoteRefs` with a remote's name: Git runs the `remote.<name>.uploadpack` command over the file transport.
  - A `git://` URL: Git runs `core.gitProxy`.
  - Only `readFileAtRevision` and `resolveCommit` read objects without running anything from the config.

### Errors

| Code                       | When                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GIT_NOT_FOUND`            | `git` isn't on the `PATH`                                                                                                                                   |
| `GIT_REPOSITORY_NOT_FOUND` | A typed helper's command, or one `assertGitSucceeded` checks, failed because the directory isn't in a repository                                            |
| `GIT_ACCESS_DENIED`        | It failed because Git refused the repository, for its ownership, `safe.directory`, or a file's permissions                                                  |
| `GIT_COMMAND_FAILED`       | It failed otherwise                                                                                                                                         |
| `GIT_INVALID_ARGUMENT`     | An argument isn't valid, such as a working directory that doesn't exist, one past Windows's path limit, a path outside the repository, or a short object ID |
| `GIT_OUTPUT_INVALID`       | Git's output isn't in the expected format, such as a path that isn't valid UTF-8                                                                            |

The failures' data holds the subcommand and the exit code, never stderr, which can show a URL with credentials in it. jg-process's `PROCESS_START_FAILED`, `PROCESS_TIMED_OUT`, `PROCESS_OUTPUT_TOO_LARGE`, and `PROCESS_TREE_SURVIVED` pass through, and an aborted `signal` rejects with its reason.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-git-commands/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-git-commands/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-git-commands/LICENSE)
