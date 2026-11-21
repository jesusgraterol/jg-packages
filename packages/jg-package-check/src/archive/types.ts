// limits for one npm tarball; numbers are positive safe integers
export type INpmTarballLimits = {
  compressedBytes: number;
  expandedBytes: number;
  entryBytes: number;
  entries: number;
};
