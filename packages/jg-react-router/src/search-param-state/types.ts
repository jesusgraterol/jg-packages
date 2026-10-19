import type { ISchema } from '../shared/index.js';

// how a search parameter holds its value: once, such as ?page=2, or repeated, such as
// ?tag=a&tag=b
export type ISearchParamKind = 'one' | 'many';

// each owned key's kind
export type ISearchParamKinds<T> = { readonly [K in keyof T]: ISearchParamKind };

// what useSearchParamState takes
export type IUseSearchParamStateOptions<T extends object> = {
  // the keys the state owns, each as 'one' or 'many'
  params: ISearchParamKinds<T>;

  // turns the URL's strings, with the defaults filling missing keys, into the state, such as a Zod
  // schema with z.coerce; a value it rejects reads as defaultValue
  schema: ISchema<T>;

  // the state without parameters; a key at its default is left out of the URL
  defaultValue: T;

  // what happens to the parameters the state doesn't own: 'preserve', the default, keeps them,
  // and 'remove' drops them
  unknownParams?: 'preserve' | 'remove' | undefined;
};

// how a state change navigates
export type ISetSearchParamStateOptions = {
  // replaces the history entry instead of adding one. Defaults to false
  replace?: boolean | undefined;
};

// changes the state, from a value or from an updater given the latest value
export type ISetSearchParamState<T> = (
  next: T | ((current: T) => T),
  options?: ISetSearchParamStateOptions,
) => void;
