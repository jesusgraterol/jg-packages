import { useLayoutEffect, useMemo, useState } from 'react';

import type {
  IIdentityBoundQueryApproval,
  IUseIdentityBoundQueryApprovalOptions,
} from './types.js';

/**
 * Decides whether an app may show the data of a query bound to the signed-in user, such as the
 * current account: it publishes the query's data only when it belongs to the signed-in subject,
 * approves the identity once that data is published and matches what the app already shows, and
 * keeps the approval through refetches and failed fetches, so the app doesn't blank out. A new
 * identity, even for the same subject, waits for its own matching data, and signing out clears
 * the approval. A settled query with another subject's data is a confirmed mismatch. An app whose
 * stored data already matches a returning identity is approved from the first render.
 * @param options The signed-in identity and subject, the subject of the data shown, and the
 * query's subject and state.
 * @returns Whether to publish the query's data, whether the identity is approved, and whether a
 * mismatch is confirmed; the same object while those don't change.
 * @example
 * import { useIdentityBoundQueryApproval } from 'jg-tanstack-query';
 *
 * declare const session: { key: string; accountId: string } | null;
 * declare const storedAccountId: string | undefined;
 * declare const accountQuery: { data?: { id: string }; isSuccess: boolean; isError: boolean };
 *
 * const { shouldPublishQueryData, isIdentityApproved } = useIdentityBoundQueryApproval({
 *   authenticatedIdentityKey: session?.key ?? null,
 *   authenticatedSubjectId: session?.accountId,
 *   approvedSubjectId: storedAccountId,
 *   querySubjectId: accountQuery.data?.id,
 *   isQueryReady: accountQuery.isSuccess,
 *   isQueryError: accountQuery.isError,
 * });
 */
export const useIdentityBoundQueryApproval = ({
  authenticatedIdentityKey,
  authenticatedSubjectId,
  approvedSubjectId,
  querySubjectId,
  isQueryReady,
  isQueryError,
}: IUseIdentityBoundQueryApprovalOptions): IIdentityBoundQueryApproval => {
  const isSignedIn = authenticatedIdentityKey !== null;
  const hasMatchingApprovedSubject =
    authenticatedSubjectId !== undefined && approvedSubjectId === authenticatedSubjectId;
  const hasMatchingQuerySubject =
    authenticatedSubjectId !== undefined && querySubjectId === authenticatedSubjectId;
  const hasSettledQuery = isSignedIn && isQueryReady && !isQueryError;
  const shouldPublishQueryData = hasSettledQuery && hasMatchingQuerySubject;
  const hasConfirmedIdentityMismatch =
    hasSettledQuery && querySubjectId !== undefined && !hasMatchingQuerySubject;
  const [approvedIdentityKey, setApprovedIdentityKey] = useState<string | null>(() =>
    isSignedIn && hasMatchingApprovedSubject ? authenticatedIdentityKey : null,
  );

  // before paint, so a replaced identity never shows the previous one's approval
  useLayoutEffect(() => {
    if (authenticatedIdentityKey === null || !hasMatchingApprovedSubject) {
      setApprovedIdentityKey(null);
    } else if (shouldPublishQueryData) {
      setApprovedIdentityKey(authenticatedIdentityKey);
    }
  }, [authenticatedIdentityKey, hasMatchingApprovedSubject, shouldPublishQueryData]);

  const isIdentityApproved =
    isSignedIn && approvedIdentityKey === authenticatedIdentityKey && hasMatchingApprovedSubject;
  return useMemo(
    () => ({ shouldPublishQueryData, isIdentityApproved, hasConfirmedIdentityMismatch }),
    [shouldPublishQueryData, isIdentityApproved, hasConfirmedIdentityMismatch],
  );
};
