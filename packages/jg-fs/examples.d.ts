// what the TSDoc examples use but don't define; release check 8 typechecks them with it, and it
// never ships

// a Zod schema, or any validator with parse
declare const Config: { parse(value: unknown): { port: number } };
