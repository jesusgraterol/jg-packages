// what useNewBuildAvailable takes
export type IUseNewBuildAvailableOptions = {
  // the page that loads the app, read again to see which build it loads. Defaults to /
  entryPath?: string | undefined;

  // the folder of the build's hashed scripts, whose entry script names the build. Defaults to /assets/
  assetPrefix?: string | undefined;
};

// what useNewBuildAvailable returns
export type IUseNewBuildAvailableResult = {
  // whether the server serves a newer build than the open page, or one of its chunks is gone
  isNewBuildAvailable: boolean;

  // reads the entry page again now, such as when the app's server connection comes back
  check: () => Promise<void>;
};
