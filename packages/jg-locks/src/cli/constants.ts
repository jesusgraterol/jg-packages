// the exit codes the CLI uses besides a command's own: 75 is EX_TEMPFAIL, and 126 and 127 are the
// shell's codes for a command that can't run and one that isn't found
export const EXIT_CODES = {
  success: 0,
  failure: 1,
  usage: 2,
  busy: 75,
  cannotRun: 126,
  notFound: 127,
} as const;

// the version of `jg-locks status --json`'s output
export const STATUS_SCHEMA_VERSION = 1;

// the code of the CLI's own error for arguments it can't use
export const USAGE_ERROR_CODE = 'JG_LOCKS_USAGE';

// the --wait value that waits until the lock is free
export const WAIT_FOREVER = 'forever';

// what `jg-locks --help` prints
export const HELP = `Usage: jg-locks <command>

Takes, shows, and recovers the named locks every program on this machine shares.

Commands:
  run <name> [--wait <seconds> | --wait forever] -- <command> [args...]
      Runs the command, without a shell, while holding the lock, and exits with its code, or 128
      plus the signal's number when a signal ended it. It forwards SIGINT and SIGTERM to the
      command. Without --wait, it exits 75 at once when another process holds the lock.
  status [--json]
      Lists every lock with its state and holder: program, folder, pid, host, nonce, whether the
      holder is alive, and for how long it has held the lock.
  recover <name> --nonce <nonce>
      Takes the lock over from the dead holder with that nonce, as status shows it, and releases
      it. Check what the holder left first. Exits 1 when the lock isn't that dead holder's.

Options:
  --help   Prints this message.

The locks live in JG_LOCKS_ROOT when it's set, otherwise in jg-locks in the operating system's
state folder. Usage errors exit 2.
`;
