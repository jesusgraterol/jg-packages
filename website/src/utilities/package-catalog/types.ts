// the runtimes a package supports: both, browsers and workers, or Node.js
export type IRuntime = 'universal' | 'browser' | 'node';

// the Lucide icon that stands for what a package is for, named as Lucide names its `lucide-<name>`
// class. docs/website.md explains how one is chosen
export type IPackageIcon =
  | 'atom'
  | 'braces'
  | 'calculator'
  | 'clipboard'
  | 'cloud-off'
  | 'container'
  | 'cpu'
  | 'database'
  | 'folder-open'
  | 'git-branch'
  | 'git-pull-request'
  | 'globe'
  | 'key-round'
  | 'lock-keyhole'
  | 'octagon-alert'
  | 'refresh-cw'
  | 'route'
  | 'server'
  | 'table-2'
  | 'wrench'
  | 'zap';

// the site's presentation of one listed package
export type IPackageCatalogEntry = {
  // a short label for what the package is for, such as 'HTTP requests'
  title: string;
  // the summary on cards and in search results, 70 to 160 characters
  description: string;
  // the icon on the package's card and page, unique in the catalog
  icon: IPackageIcon;
  // the runtimes, the first of which groups the package on the home page
  runtimes: readonly [IRuntime, ...IRuntime[]];
  // the position in the catalog, from 1
  order: number;
};

// a listed package as the pages use it: its catalog entry with its name and version
export type IListedPackage = IPackageCatalogEntry & {
  name: string;
  version: string;
};

// the fields of a package.json the catalog checks
export type IWorkspaceManifest = {
  name: string;
  version: string;
  private?: boolean | undefined;
};
