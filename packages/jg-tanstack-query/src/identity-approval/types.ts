// what useIdentityBoundQueryApproval takes
export type IUseIdentityBoundQueryApprovalOptions = {
  // the signed-in session's identity, such as `${accountId}:${authUserId}`, which changes when
  // another user, or the same user through another sign-in, takes over; null when signed out
  authenticatedIdentityKey: string | null;

  // the subject the session is signed in as, such as the account's id, or undefined before it's
  // known
  authenticatedSubjectId: string | undefined;

  // the subject the data the app already shows belongs to, such as from its persisted store, or
  // undefined when it shows none
  approvedSubjectId: string | undefined;

  // the subject the query's latest data belongs to, or undefined without data
  querySubjectId: string | undefined;

  // whether the query has settled with data for the current identity
  isQueryReady: boolean;

  // whether the query's latest fetch failed
  isQueryError: boolean;
};

// what useIdentityBoundQueryApproval decides
export type IIdentityBoundQueryApproval = {
  // whether the query's data belongs to the signed-in subject, so the app may store and show it
  shouldPublishQueryData: boolean;

  // whether the signed-in identity was approved, which lasts through refetches and failed fetches,
  // so the app keeps showing the data it already has
  isIdentityApproved: boolean;

  // whether a settled query returned another subject's data, so the app should sign out or reset
  hasConfirmedIdentityMismatch: boolean;
};
