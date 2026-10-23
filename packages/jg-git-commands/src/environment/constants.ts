// the SSH command Git uses unless the options give another: no password or passphrase prompt, and
// a connection that gives up after 10 seconds
export const DEFAULT_GIT_SSH_COMMAND = 'ssh -o BatchMode=yes -o ConnectTimeout=10';

/*
 * The variables every git command runs with, so it never prompts, never takes a lock it doesn't
 * need, never reads replaced objects, never fetches missing ones, reads paths literally, and writes
 * its messages in English, which lets a failure be classified. An empty GIT_ASKPASS ends Git's
 * askpass lookup before core.askPass and SSH_ASKPASS. GCM_INTERACTIVE=never makes Git Credential
 * Manager, a credential helper that opens its own sign-in window, fail rather than prompt; it
 * takes precedence over the credential.interactive config. An empty GIT_ALLOW_PROTOCOL allows no
 * transport, which also stops a partial clone fetching a missing object on Git versions before
 * GIT_NO_LAZY_FETCH, even against a repository's protocol.file.allow; commands that reach a
 * remote allow HTTPS and SSH themselves.
 */
export const NON_INTERACTIVE_VARIABLES = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '',
  GCM_INTERACTIVE: 'never',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_LITERAL_PATHSPECS: '1',
  GIT_ALLOW_PROTOCOL: '',
  LC_ALL: 'C',
  LANG: 'C',
  LANGUAGE: 'C',
} as const;
