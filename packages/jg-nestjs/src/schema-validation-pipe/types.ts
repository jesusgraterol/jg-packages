// a validation issue as a Standard Schema validator, such as Zod, reports it
export type IStandardSchemaIssue = {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
};

// a validation issue as a 400 response's data carries it, such as `{ path: ['items', 0], message }`
export type IValidationIssue = {
  path: (string | number)[];
  message: string;
};
