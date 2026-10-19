// what admitUsage decides, with when to try again: accepted, refused by the scope's cooldown, or
// refused because the actor reached the limit within the window
export type IUsageAdmission =
  | { outcome: 'accepted'; retryAt: string | null }
  | { outcome: 'cooldown'; retryAt: string }
  | { outcome: 'limit'; retryAt: null };

// what admitUsage counts and limits
export type IUsageAdmissionInput = {
  // who acts, such as a user's id: 1 to 256 characters
  actorId: string;

  // what they do, such as `send-invitation`: 1 to 128 characters
  actionId: string;

  // what they act on, such as the invited email's hash, which the cooldown applies to: 1 to 256
  // characters
  scopeKey?: string | undefined;

  // the most times the actor may do the action within the window
  limit: number;

  // the seconds the limit counts back from now
  windowSeconds: number;

  // the seconds after an accepted action before the same action on the same scope is accepted
  // again, by any actor. Only with a scopeKey
  cooldownSeconds?: number | undefined;
};
