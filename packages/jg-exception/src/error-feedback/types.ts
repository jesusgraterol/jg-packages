// how createErrorFeedback turns errors into what users read
export type IErrorFeedbackOptions = {
  // what users read for an error without copy of its own
  fallbackMessage: string;

  // the copy users read for each code, written for them rather than for the logs
  messagesByCode?: Readonly<Record<string, string>> | undefined;

  // the codes that mean the user isn't allowed to do what they tried, such as a revoked session
  accessDeniedCodes?: Iterable<string> | undefined;

  // the codes that are safe to show users without copy of their own, such as `/^AUTH_/`
  publicCodePattern?: RegExp | undefined;
};

// what one call replaces, for a screen whose errors need copy of their own
export type IErrorFeedbackOverrides = {
  // what users read for an error without copy of its own, instead of the configured fallback
  fallbackMessage?: string | undefined;

  // the copy users read for each code, which wins over the configured copy for the same code
  messagesByCode?: Readonly<Record<string, string>> | undefined;
};

// what a UI shows for an error
export type IErrorFeedback = {
  // the copy for the error's code, or the fallback
  message: string;

  // the error's code when it's safe to show, otherwise `null`
  code: string | null;

  // whether the error is an `AbortError`, which usually means the user cancelled the work
  isCancelled: boolean;

  // whether the error's code is one of the access-denied codes
  isAccessDenied: boolean;
};
