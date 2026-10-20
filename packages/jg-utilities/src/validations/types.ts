// the options accepted by isPortablePathValid
export type IPortablePathOptions = {
  // the most UTF-8 bytes one component may take, such as a file's name. Defaults to 255
  maxComponentBytes?: number | undefined;

  // the most UTF-8 bytes the whole path may take. Without it, only its components are limited
  maxPathBytes?: number | undefined;

  // a pattern every component must match as well, such as /^[a-z0-9._-]+$/ for lowercase names
  componentPattern?: RegExp | undefined;
};
