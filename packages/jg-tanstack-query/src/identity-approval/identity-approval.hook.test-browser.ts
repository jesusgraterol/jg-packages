import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { useIdentityBoundQueryApproval } from './identity-approval.hook.js';
import type { IUseIdentityBoundQueryApprovalOptions } from './types.js';

const SUBJECT_ID = 'account-a';
const IDENTITY_KEY = 'account-a:sign-in-1';
const REPLACEMENT_IDENTITY_KEY = 'account-a:sign-in-2';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

/**
 * Builds the options of a signed-in user whose query returned their own data, changed by the
 * overrides.
 * @param overrides The options to change.
 * @returns The options.
 */
const optionsWith = (
  overrides: Partial<IUseIdentityBoundQueryApprovalOptions> = {},
): IUseIdentityBoundQueryApprovalOptions => ({
  authenticatedIdentityKey: IDENTITY_KEY,
  authenticatedSubjectId: SUBJECT_ID,
  approvedSubjectId: undefined,
  querySubjectId: SUBJECT_ID,
  isQueryReady: true,
  isQueryError: false,
  ...overrides,
});

/**
 * Renders the hook with its options as props, so a test can change them.
 * @param options The hook's options.
 * @returns The rendered hook.
 */
const renderApproval = (options: IUseIdentityBoundQueryApprovalOptions) =>
  renderHook(
    (props: IUseIdentityBoundQueryApprovalOptions) => useIdentityBoundQueryApproval(props),
    {
      initialProps: options,
    },
  );

describe('useIdentityBoundQueryApproval', () => {
  test('publishes matching data on a cold start, and approves once the app shows it', () => {
    const { result, rerender } = renderApproval(optionsWith());
    expect(result.current).toStrictEqual({
      shouldPublishQueryData: true,
      isIdentityApproved: false,
      hasConfirmedIdentityMismatch: false,
    });

    rerender(optionsWith({ approvedSubjectId: SUBJECT_ID }));

    expect(result.current).toStrictEqual({
      shouldPublishQueryData: true,
      isIdentityApproved: true,
      hasConfirmedIdentityMismatch: false,
    });
  });

  test('keeps the approval through a refetch and a failed fetch', () => {
    const { result, rerender } = renderApproval(optionsWith({ approvedSubjectId: SUBJECT_ID }));

    rerender(optionsWith({ approvedSubjectId: SUBJECT_ID, isQueryReady: false }));
    expect(result.current.isIdentityApproved).toBe(true);
    rerender(
      optionsWith({
        approvedSubjectId: SUBJECT_ID,
        isQueryReady: false,
        isQueryError: true,
        querySubjectId: undefined,
      }),
    );

    expect(result.current).toStrictEqual({
      shouldPublishQueryData: false,
      isIdentityApproved: true,
      hasConfirmedIdentityMismatch: false,
    });
  });

  test('resets the approval for a new identity of the same subject until its data matches', () => {
    const { result, rerender } = renderApproval(optionsWith({ approvedSubjectId: SUBJECT_ID }));

    rerender(
      optionsWith({
        approvedSubjectId: SUBJECT_ID,
        authenticatedIdentityKey: REPLACEMENT_IDENTITY_KEY,
        isQueryReady: false,
        querySubjectId: undefined,
      }),
    );
    expect(result.current).toStrictEqual({
      shouldPublishQueryData: false,
      isIdentityApproved: false,
      hasConfirmedIdentityMismatch: false,
    });

    rerender(
      optionsWith({
        approvedSubjectId: SUBJECT_ID,
        authenticatedIdentityKey: REPLACEMENT_IDENTITY_KEY,
      }),
    );
    expect(result.current.isIdentityApproved).toBe(true);
  });

  test('clears the approval on sign-out, and keeps it cleared on sign-in until data matches', () => {
    const { result, rerender } = renderApproval(optionsWith({ approvedSubjectId: SUBJECT_ID }));

    rerender(
      optionsWith({
        authenticatedIdentityKey: null,
        authenticatedSubjectId: undefined,
        isQueryReady: false,
        querySubjectId: undefined,
      }),
    );
    expect(result.current).toStrictEqual({
      shouldPublishQueryData: false,
      isIdentityApproved: false,
      hasConfirmedIdentityMismatch: false,
    });

    rerender(optionsWith({ approvedSubjectId: SUBJECT_ID, isQueryReady: false }));
    expect(result.current.isIdentityApproved).toBe(false);
  });

  test("confirms a mismatch when a settled query returns another subject's data", () => {
    const { result, rerender } = renderApproval(optionsWith({ querySubjectId: 'account-b' }));

    expect(result.current).toStrictEqual({
      shouldPublishQueryData: false,
      isIdentityApproved: false,
      hasConfirmedIdentityMismatch: true,
    });
    rerender(optionsWith({ querySubjectId: 'account-b', isQueryError: true }));
    expect(result.current.hasConfirmedIdentityMismatch).toBe(false);
  });

  test('approves a returning identity whose stored data matches from the first render, even while its query fails', () => {
    const { result } = renderApproval(
      optionsWith({
        approvedSubjectId: SUBJECT_ID,
        isQueryReady: false,
        isQueryError: true,
        querySubjectId: undefined,
      }),
    );

    expect(result.current).toStrictEqual({
      shouldPublishQueryData: false,
      isIdentityApproved: true,
      hasConfirmedIdentityMismatch: false,
    });
  });

  test('gives the same object while its decisions stay the same', () => {
    const { result, rerender } = renderApproval(optionsWith({ approvedSubjectId: SUBJECT_ID }));
    const first = result.current;

    rerender(optionsWith({ approvedSubjectId: SUBJECT_ID }));

    expect(result.current).toBe(first);
  });
});
