// what createCorsOptions takes
export type ICorsOptionsInput = {
  // the browser origins the API serves, such as `https://app.example.com`
  origins: readonly string[];

  // whether a request without an Origin header, such as one from a server or a command-line
  // client, is allowed. Defaults to true
  allowOriginless?: boolean | undefined;

  // whether each origin also allows its `www.` variant, or the one without it, with the same
  // scheme and port. Defaults to true
  includeWwwVariants?: boolean | undefined;

  // whether browsers may send cookies and other credentials. Defaults to false
  credentials?: boolean | undefined;
};
