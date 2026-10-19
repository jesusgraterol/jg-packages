// the SSH command Git uses unless the options give another: no password or passphrase prompt, and
// a connection that gives up after 10 seconds
export const DEFAULT_GIT_SSH_COMMAND = 'ssh -o BatchMode=yes -o ConnectTimeout=10';

// the variables every git command runs with, so it never prompts, never takes a lock it doesn't
// need, never reads replaced objects, never fetches missing ones, and reads paths literally. An
// empty GIT_ASKPASS ends Git's askpass lookup before core.askPass and SSH_ASKPASS
export const NON_INTERACTIVE_VARIABLES = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_LITERAL_PATHSPECS: '1',
} as const;
