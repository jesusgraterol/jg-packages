// what useCopyFeedback takes
export type IUseCopyFeedbackOptions = {
  // how long isCopied stays true after a copy, in seconds: positive and finite. Defaults to
  // DEFAULT_COPY_FEEDBACK_SECONDS
  durationSeconds?: number | undefined;

  // receives a failed copy's error, such as to show why it failed. The latest one is called
  onError?: ((error: unknown) => void) | undefined;
};

// what useCopyFeedback returns
export type IUseCopyFeedbackResult = {
  // whether a copy just succeeded, for a moment
  isCopied: boolean;

  // calls write at once, inside the click that called copy, and resolves to whether it succeeded.
  // It never rejects, and resolves to false at once while another copy runs
  copy: (write: () => unknown) => Promise<boolean>;
};
