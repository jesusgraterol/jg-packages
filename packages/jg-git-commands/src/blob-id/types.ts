// the hash algorithms Git names objects with
export type IGitObjectFormat = 'sha1' | 'sha256';

// what calculateGitBlobObjectId takes
export type ICalculateGitBlobObjectIdOptions = {
  // the repository's object format. Defaults to 'sha1'
  algorithm?: IGitObjectFormat | undefined;
};
