// optional size and cancellation limits for hashing
export type IHashFileOptions = {
  maxBytes?: number;
  signal?: AbortSignal | undefined;
};

// the byte count and lowercase SHA-256 of the same file content
export type IFileHash = {
  size: number;
  sha256: string;
};
