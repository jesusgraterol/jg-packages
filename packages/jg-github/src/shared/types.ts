// what createGithubHeaders takes
export type IGithubHeadersOptions = {
  // the User-Agent GitHub requires on every request, such as the app's name
  userAgent: string;

  // the REST API version. Defaults to GITHUB_API_VERSION
  apiVersion?: string | undefined;
};

// what buildGithubApiUrl takes
export type IGithubApiUrlOptions = {
  // the API's base URL, such as `https://ghe.example.com/api/v3` for GitHub Enterprise Server.
  // Defaults to GITHUB_API_ORIGIN
  apiOrigin?: string | undefined;
};

// the query parameters a URL builder appends; undefined ones are left out
export type IGithubQuery = Record<string, string | number | boolean | undefined>;

// a file in a repository, at a ref
export type IGithubRawContentLocation = {
  // the account that owns the repository
  owner: string;

  // the repository's name
  repository: string;

  // the branch, tag, or commit, such as `main` or `feature/login`
  ref: string;

  // the file's path from the repository's root, such as `docs/setup.md`
  path: string;
};

// what buildGithubRawContentUrl takes
export type IGithubRawContentUrlOptions = {
  // the raw content's base URL. Defaults to GITHUB_RAW_CONTENT_ORIGIN
  rawContentOrigin?: string | undefined;
};
