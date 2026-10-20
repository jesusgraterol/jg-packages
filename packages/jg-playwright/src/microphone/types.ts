// options for installFakeMicrophone
export type IFakeMicrophoneOptions = {
  // refuses the page's first microphone request with NotAllowedError, as a person who blocks the
  // permission prompt would, then grants the next one
  rejectFirstRequest?: boolean | undefined;
};
