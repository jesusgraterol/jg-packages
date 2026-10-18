// a command a form edits, compared by value as JSON
export type IFormChangesComparable = object;

// what useFormChanges compares: the command being edited against the last confirmed one
export type IUseFormChangesOptions<
  TCommand extends IFormChangesComparable,
  TNormalizedCommand extends IFormChangesComparable = TCommand,
> = {
  // the command as the server last confirmed it, such as the saved profile
  confirmedCommand: TCommand;

  // the command the form holds now
  currentCommand: TCommand;

  // turns a command into the form both are compared in, such as with trimmed text
  normalizeCommand?: ((command: TCommand) => TNormalizedCommand) | undefined;
};

// whether the form holds changes, and what advances its baseline
export type IUseFormChangesResult<TCommand extends IFormChangesComparable> = {
  // makes a command the baseline, once the server confirmed saving it
  confirmChanges: (command: TCommand) => void;

  // checks, as the form submits, whether a command still differs from the baseline
  guardSubmission: (command: TCommand) => boolean;

  // whether the current command differs from the baseline
  hasChanges: boolean;
};
