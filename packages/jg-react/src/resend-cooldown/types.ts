// what useResendCooldown takes
export type IUseResendCooldownOptions = {
  // how long a resend waits after a send, in seconds: a positive integer
  durationSeconds: number;

  // what the cooldown is for, such as `${accountId}:verify-email`, so it survives a reload of the
  // tab and stays apart from other accounts' and actions'. Without it, nothing is stored
  cooldownKey?: string | undefined;

  // when the server says the last send happened, used until the tab sends one itself
  lastAttemptedAt?: string | number | Date | null | undefined;

  // the jg-storage session store holding the deadlines: letters, digits, underscores, and hyphens.
  // Defaults to 'resend-cooldowns'
  storeId?: string | undefined;
};

// the cooldown's state, and what starts it
export type IUseResendCooldownResult = {
  // whether a resend must wait
  isCoolingDown: boolean;

  // the whole seconds left, rounded up, 0 when it needn't wait
  remainingSeconds: number;

  // starts the cooldown, once the server acknowledged a send
  startCooldown: () => void;
};
