// what createGithubAppJwt takes
export type ICreateGithubAppJwtOptions = {
  // the App's ID, such as 123456, or its client ID
  appId: string | number;

  // the App's private key, PEM-encoded, as GitHub downloads it
  privateKey: string;

  // the time the JWT is issued at. Defaults to now
  now?: Date | undefined;
};
