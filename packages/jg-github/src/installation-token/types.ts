// the access a GitHub App permission grants
export type IGithubPermissionLevel = 'read' | 'write' | 'admin';

// the permissions of an installation token, by GitHub's names, such as { contents: 'read' }
export type IGithubPermissions = Record<string, IGithubPermissionLevel>;

// a repository an installation token can reach
export type IGithubRepository = {
  // the repository's ID
  id: number;

  // the repository's owner and name, such as 'acme/app'
  fullName: string;
};

// what every request to GitHub's REST API takes
export type IGithubRequestOptions = {
  // the User-Agent GitHub requires on every request, such as the app's name
  userAgent: string;

  // the API's base URL, such as `https://ghe.example.com/api/v3` for GitHub Enterprise Server.
  // Defaults to GITHUB_API_ORIGIN
  apiOrigin?: string | undefined;

  // the REST API version. Defaults to GITHUB_API_VERSION
  apiVersion?: string | undefined;

  // the seconds the request may take. Defaults to 10
  timeoutSeconds?: number | undefined;

  // stops the request when it aborts
  signal?: AbortSignal | undefined;
};

// the repositories an installation token is for: by name or by ID, never both
export type IInstallationTokenRepositories =
  | {
      // the repositories' names, without the owner, such as ['app', 'docs']
      repositories: readonly string[];
      repositoryIds?: undefined;
    }
  | {
      // the repositories' IDs
      repositoryIds: readonly number[];
      repositories?: undefined;
    };

// what createInstallationToken takes
export type ICreateInstallationTokenOptions = IGithubRequestOptions &
  IInstallationTokenRepositories & {
    // the App's ID, such as 123456, or its client ID
    appId: string | number;

    // the App's private key, PEM-encoded
    privateKey: string;

    // the installation's ID, such as 12345678
    installationId: string | number;

    // the permissions the token needs, at least one; GitHub would grant every permission of the
    // installation without them
    permissions: IGithubPermissions;

    // the bytes GitHub's answer may take. Defaults to 128 KiB
    maxResponseBytes?: number | undefined;
  };

// an installation token, scoped as requested
export type IInstallationToken = {
  // the token, sent as a bearer credential
  token: string;

  // when it expires, an hour after it was created
  expiresAt: Date;

  // the permissions it grants: the ones requested, and `metadata: 'read'` when GitHub adds it
  permissions: Record<string, string>;

  // the repositories it reaches, exactly the ones requested
  repositories: IGithubRepository[];
};
