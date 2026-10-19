// how one action's challenges behave: how long they last, how many wrong codes they take, and how
// many an actor may be issued within a window
export type IVerificationPolicy = {
  // the whole seconds a challenge stays valid after it's issued, at least 1
  validitySeconds: number;

  // the wrong codes a challenge takes before it stops accepting any: 1 to 32,767
  maxFailedAttempts: number;

  // the most challenges an actor may be issued for the action within the window, over every target
  issueLimit: number;

  // the whole seconds the issue limit counts back from now, at least 1
  issueWindowSeconds: number;

  // the times one challenge's code may be resent, each time as a new code: 1 to 32,767. Without
  // it, resend refuses the action
  resendLimit?: number | undefined;

  // the whole seconds that must pass between two sends of one challenge, counted from its issue or
  // its last resend, at least 1. Without it, a challenge may be resent at once
  resendCooldownSeconds?: number | undefined;
};

// what createVerificationChallenges takes
export type IVerificationChallengesOptions = {
  // each action's policy, keyed by its action id, such as `verify-email`
  policies: Record<string, IVerificationPolicy>;

  // the code's digits: 4 to 10. Defaults to 6
  codeLength?: number | undefined;
};

// who a challenge is for, what it verifies, and what on
export type IVerificationBinding = {
  // who verifies, such as a user's id: 1 to 256 characters
  actorId: string;

  // what they verify, such as `verify-email`, which must have a policy: 1 to 128 characters
  actionId: string;

  // what they verify it on, such as the new email address: 1 to 256 characters
  targetId: string;
};

// what deliver receives once the challenge is committed, to send the code to the actor
export type IVerificationDelivery = IVerificationBinding & {
  // the code to send, and the only time it's available
  code: string;

  // the challenge's id, the same for its issue and every resend
  challengeId: string;

  // this send's id, `${challengeId}:${resendCount}`, `:0` for the issue: the same for every attempt
  // to send this code and different for each resend, so use it as the email's idempotency key
  deliveryId: string;

  // when the code stops working, as an ISO 8601 UTC timestamp. A resend keeps the issue's
  expiresAt: string;

  // the seconds the code is valid for, as the policy sets them
  validitySeconds: number;

  // the whole seconds left before the code stops working: validitySeconds for an issue, and less
  // for a resend, which keeps the issue's expiry
  remainingSeconds: number;
};

// sends a challenge's code to its actor, such as by email
export type IVerificationDeliver = (delivery: IVerificationDelivery) => Promise<void> | void;

/*
 * What issue resolves to: the challenge's token, which the client keeps and sends back with the
 * code, and when it expires; or, when the actor reached the policy's issue limit, when they may be
 * issued one again.
 */
export type IVerificationIssue =
  | { outcome: 'issued'; challengeToken: string; expiresAt: string }
  | { outcome: 'limit'; retryAt: string };

// what consume checks: the binding the challenge was issued for, its token, and the code
export type IVerificationAttempt = IVerificationBinding & {
  // the token issue resolved to
  challengeToken: string;

  // the code the actor received
  code: string;
};

// what resend takes: the binding the challenge was issued for, and its token
export type IVerificationResendRequest = IVerificationBinding & {
  // the token issue resolved to
  challengeToken: string;
};

/*
 * What resend resolves to: a new code was sent, under the challenge's original expiry; the
 * challenge is cooling down until retryAt; it was resent as often as the policy allows; or there's
 * no active challenge for the binding and token, because it was used, superseded, expired, or ran
 * out of attempts.
 */
export type IVerificationResend =
  | { outcome: 'resent'; expiresAt: string }
  | { outcome: 'cooldown'; retryAt: string }
  | { outcome: 'limit' }
  | { outcome: 'invalid' };

// issues and consumes verification challenges with the policies they were created with
export type IVerificationChallenges = {
  // issues a challenge for a binding, superseding its active one, and delivers its code once it's
  // committed, unless the actor reached the issue limit
  issue: (
    binding: IVerificationBinding,
    deliver: IVerificationDeliver,
  ) => Promise<IVerificationIssue>;

  // sends a new code for a binding's active challenge, keeping its token and expiry, which stops
  // the earlier code from working, unless the challenge is cooling down or reached its resend limit
  resend: (
    request: IVerificationResendRequest,
    deliver: IVerificationDeliver,
  ) => Promise<IVerificationResend>;

  // uses a challenge when its code matches, or counts a failed attempt, and resolves to whether
  // it matched
  consume: (attempt: IVerificationAttempt) => Promise<boolean>;
};
