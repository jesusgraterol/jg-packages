// the seconds stopProcessTree keeps checking after SIGKILL before it gives up
export const FORCED_STOP_SECONDS = 2;

// the seconds the process list and taskkill may each run, and then the seconds to wait for the
// tree's exit, on Windows
export const WINDOWS_STOP_SECONDS = 10;

/*
 * The PowerShell command that lists every Windows process as `pid parentPid createdAt`, the start
 * as a file time, or 0 when it can't be read, from Win32_Process, which records each process's
 * parent. It runs before taskkill, so the stop knows which processes to wait for.
 */
export const WINDOWS_PROCESS_LIST_COMMAND =
  "Get-CimInstance -ClassName Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 }) }";

// the milliseconds between checks of whether a process tree is gone
export const STOP_POLL_INTERVAL_MILLISECONDS = 50;

// a line of WINDOWS_PROCESS_LIST_COMMAND's output: a process's id, its parent's, and its start
export const WINDOWS_PROCESS_LINE_PATTERN = /^(\d+) (\d+) (\d+)$/u;
