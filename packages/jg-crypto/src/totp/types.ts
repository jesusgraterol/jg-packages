// what verifyTotp takes besides the secret and the code
export type IVerifyTotpOptions = {
  /*
   * Records that a time step's code was used, so it can't be used again, and resolves to whether
   * this call recorded it: false when it was already used. It runs once, after the code matches,
   * with that step, such as `(step) => claimOnce(redis, 'totp:' + userId, String(step), 150)`.
   * What it throws or rejects with passes through.
   */
  claimStep: (step: number) => boolean | Promise<boolean>;
};
