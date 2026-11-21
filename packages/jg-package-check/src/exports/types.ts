// the package name and the root (.) or subpaths (./name) to exercise in Node.js
export type IPackedExportCheck = {
  packageName: string;
  importSubpaths?: string[];
  privateSubpaths?: string[];
  timeoutSeconds?: number;
};
