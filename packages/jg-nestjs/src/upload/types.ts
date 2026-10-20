// what createUploadInterceptor takes
export type IUploadInterceptorOptions = {
  // the multipart field that holds the file, the only part a request may send
  field: string;

  // the most bytes the file may hold
  maxBytes: number;

  // the most requests that may hold a slot at once, from the upload's start until the handler ends
  maxConcurrent: number;

  // the seconds an upload may take before its connection is closed
  uploadTimeoutSeconds: number;
};
