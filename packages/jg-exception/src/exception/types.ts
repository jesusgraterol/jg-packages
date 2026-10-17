// the native options the Exception constructor accepts, such as `cause`
export type IErrorOptions = ErrorOptions;

// an Exception as a plain object, such as for logging or serialization
export type IExceptionRecord = {
  message: string;
  code: string;
  data: unknown;
};
