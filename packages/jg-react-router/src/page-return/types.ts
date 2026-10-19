import type { ISchema } from '../shared/index.js';

// a page to return to: its href, with only the query it keeps, and the label of the link back
export type IPageReturnOrigin = {
  href: string;
  label: string;
};

// what createPageReturn takes
export type IPageReturnOptions = {
  // the router state key the origin is kept under. Defaults to `pageReturn`
  stateKey?: string | undefined;

  // paths an origin must not lead to, such as `/sign-in`, or anything under them
  excludedPaths?: readonly string[] | undefined;

  // turns an origin's URL, already a safe internal path with no trailing slash and no hash, into
  // the page to return to, with the label of the link back and only the query it keeps, such as
  // through retainSearchParams, or null for a page the app doesn't return to
  resolveOrigin: (url: URL) => IPageReturnOrigin | null;
};

// how resolve treats the current page
export type IResolvePageReturnOptions = {
  // the page the current one's own back link leads to, so an origin equal to it isn't offered
  parentHref?: string | undefined;
};

// what resolve gives: the page to return to, or null, and the router state to return with, the
// current state without the origin, so the return doesn't offer a way back again
export type IPageReturnResolution = {
  returnTo: IPageReturnOrigin | null;
  returnState: Record<string, unknown> | undefined;
};

// records where a navigation came from, and resolves the way back to it
export type IPageReturn = {
  // the router state for a navigation from href: the current state, with the origin replacing an
  // earlier one, or without one when href isn't a page to return to
  createState: (href: string, state?: unknown) => Record<string, unknown>;

  // the way back from the current page, given the router state it was reached with
  resolve: (
    state: unknown,
    currentHref: string,
    options?: IResolvePageReturnOptions,
  ) => IPageReturnResolution;

  // a candidate href as the page to return to, or null when it isn't one
  normalizeOrigin: (candidate: unknown) => IPageReturnOrigin | null;
};

// how retainSearchParams keeps one parameter
export type IRetainedSearchParamRule = {
  // checks the value, throwing for one that isn't valid, such as a Zod enum
  schema?: ISchema<unknown> | undefined;

  // the value the page shows without the parameter, which is left out
  defaultValue?: string | undefined;
};
