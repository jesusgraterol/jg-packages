// a validator with a parse method that returns valid data or throws, such as a Zod schema
export type ISchema<T> = {
  parse(value: unknown): T;
};
