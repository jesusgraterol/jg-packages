// validates data and returns it typed, which a Zod schema does
export type ISchema<T> = {
  parse(value: unknown): T;
};
