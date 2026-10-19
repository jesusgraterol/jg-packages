// how a dialog session behaves
export type IDialogSessionOptions = {
  // what open does while a session is open: 'replace', the default, resolves the open session's
  // caller with undefined and opens the new one; 'keep' leaves the open one and resolves the new
  // call with undefined
  whileOpen?: 'replace' | 'keep' | undefined;

  // whether closing returns focus to the element the session was opened from. Defaults to true
  restoreFocus?: boolean | undefined;
};

// how one open call starts its session
export type IDialogSessionOpenInit = {
  // the element focus returns to once the session closes. Defaults to the element that has focus
  // when the session opens, or, when it replaces one, to that session's element
  returnFocusTo?: HTMLElement | null | undefined;
};

// an open session: the same object for as long as the session lasts
export type IDialogSessionSnapshot<TOptions> = {
  // the session's id, which close can name so a stale close does nothing
  readonly id: number;

  // what the dialog shows, as open received it
  readonly options: TOptions;

  // the element focus returns to once the session closes
  readonly returnFocusTo: HTMLElement | null;
};

// one dialog's sessions: at most one open at a time, each resolving its caller's promise once
export type IDialogSession<TOptions, TResult> = {
  // opens a session and resolves to the result it closes with, or undefined when it closes
  // without one or another session replaces it; it never rejects
  open: (options: TOptions, init?: IDialogSessionOpenInit) => Promise<TResult | undefined>;

  // closes the open session with a result, or only the session with the given id, and returns
  // whether one closed
  close: (result?: TResult, id?: number) => boolean;

  // the open session, or null
  getSnapshot: () => IDialogSessionSnapshot<TOptions> | null;

  // calls the listener when a session opens or closes, and returns what stops that
  subscribe: (listener: () => void) => () => void;
};
