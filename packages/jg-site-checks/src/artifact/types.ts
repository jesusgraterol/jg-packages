// the inventory and its bounded text reader
export type IArtifactIndex = {
  files: Set<string>;
  readText: (file: string) => Promise<string>;
};
