// one option parseStrictArgs accepts: a flag, or a string that can be required or repeated
export type IStrictArgOption =
  | { type: 'boolean' }
  | { type: 'string'; multiple?: boolean | undefined; required?: boolean | undefined };

// the values parseStrictArgs returns for its options: false for a missing flag, an empty array
// for a missing repeated option, and undefined for a missing optional string
export type IStrictArgValues<TOptions extends Record<string, IStrictArgOption>> = {
  [TName in keyof TOptions]: TOptions[TName] extends { type: 'boolean' }
    ? boolean
    : TOptions[TName] extends { multiple: true }
      ? string[]
      : TOptions[TName] extends { required: true }
        ? string
        : string | undefined;
};

// how readStdin reads
export type IReadStdinOptions = {
  // the most bytes stdin may hold, a positive safe integer
  maxBytes: number;

  // stops reading and rejects with the signal's reason when it aborts
  signal?: AbortSignal | undefined;
};
