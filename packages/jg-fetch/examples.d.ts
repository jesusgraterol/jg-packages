// what the TSDoc examples use but don't define; release check 8 typechecks them with it, and it
// never ships

// the data an API returns
type IUser = { id: number; name: string };

// the API's origin
declare const baseUrl: string;

// reads a fresh access token, such as from an auth SDK
declare const getToken: () => Promise<string>;
