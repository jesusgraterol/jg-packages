// one process in a snapshot of Windows' processes
export type IWindowsProcess = {
  pid: number;
  parentPid: number;
  // when it started, in 100-nanosecond intervals since 1601, as Windows counts file times
  createdAt: bigint;
};
