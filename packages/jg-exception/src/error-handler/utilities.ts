import { DEFAULT_MESSAGE, REDACTED_VALUE } from '../shared/constants.js';

/*
 * message redaction helpers
 */

// an index range holding sensitive message content
type IMessageRange = {
  start: number;
  end: number;
};

/**
 * Collects every occurrence range for the provided sensitive values, including overlaps.
 * @param message The message to inspect.
 * @param sensitiveValues The exact case-sensitive values to locate.
 * @returns The ranges containing sensitive message content.
 */
const collectSensitiveRanges = (
  message: string,
  sensitiveValues: readonly string[],
): IMessageRange[] => {
  const sensitiveRanges: IMessageRange[] = [];

  sensitiveValues.forEach((sensitiveValue) => {
    let matchStart = message.indexOf(sensitiveValue);

    while (matchStart !== -1) {
      sensitiveRanges.push({
        start: matchStart,
        end: matchStart + sensitiveValue.length,
      });
      matchStart = message.indexOf(sensitiveValue, matchStart + 1);
    }
  });

  return sensitiveRanges;
};

/**
 * Merges overlapping sensitive ranges without combining adjacent independent ranges.
 * @param sensitiveRanges The ranges to merge.
 * @returns The sorted non-overlapping sensitive ranges.
 */
const mergeOverlappingRanges = (sensitiveRanges: readonly IMessageRange[]): IMessageRange[] => {
  const sortedSensitiveRanges = [...sensitiveRanges].sort(
    (firstRange, secondRange) =>
      firstRange.start - secondRange.start || secondRange.end - firstRange.end,
  );
  const mergedSensitiveRanges: IMessageRange[] = [];

  sortedSensitiveRanges.forEach((currentRange) => {
    const previousRange = mergedSensitiveRanges.at(-1);

    if (!previousRange || currentRange.start >= previousRange.end) {
      mergedSensitiveRanges.push({ ...currentRange });
      return;
    }

    if (currentRange.end > previousRange.end) {
      previousRange.end = currentRange.end;
    }
  });

  return mergedSensitiveRanges;
};

/**
 * Replaces every literal sensitive value in a message with the redaction marker.
 * @param message The message to redact.
 * @param sensitiveValues The exact case-sensitive values to redact.
 * @returns The message with matching sensitive values redacted.
 */
export const redactSensitiveValues = (message: string, sensitiveValues: string[]): string => {
  const uniqueSensitiveValues = [
    ...new Set(sensitiveValues.filter((sensitiveValue) => sensitiveValue.length > 0)),
  ];

  if (!uniqueSensitiveValues.length) {
    return message;
  }

  const sensitiveRanges = mergeOverlappingRanges(
    collectSensitiveRanges(message, uniqueSensitiveValues),
  );

  if (!sensitiveRanges.length) {
    return message;
  }

  const redactedMessageParts: string[] = [];
  let nextMessageIndex = 0;

  sensitiveRanges.forEach((sensitiveRange) => {
    redactedMessageParts.push(
      message.slice(nextMessageIndex, sensitiveRange.start),
      REDACTED_VALUE,
    );
    nextMessageIndex = sensitiveRange.end;
  });
  redactedMessageParts.push(message.slice(nextMessageIndex));

  return redactedMessageParts.join('');
};

/*
 * Zod error helpers. A ZodError is recognised by its shape rather than with `instanceof`, so zod
 * isn't a dependency and errors from any installed copy of zod are handled.
 */

// the parts of a ZodError the message extraction reads
export type IZodErrorLike = {
  name: string;
  issues: unknown[];
};

/**
 * Checks whether a value looks like a ZodError: an object named `ZodError` with an `issues` array.
 * @param error The value to check.
 * @returns Whether the value is shaped like a ZodError.
 */
export const isZodErrorLike = (error: unknown): error is IZodErrorLike =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'ZodError' &&
  Array.isArray((error as { issues?: unknown }).issues);

/**
 * Extracts a ZodError's first issue as `${message} (${path})`, with `Unknown path` for an issue
 * at the root. Returns the default message when the first issue has no message.
 * @param error The ZodError to extract the message from.
 * @returns The extracted message, or the default message.
 */
export const extractZodErrorMessage = (error: IZodErrorLike): string => {
  const [issue] = error.issues;
  if (typeof issue !== 'object' || issue === null) {
    return DEFAULT_MESSAGE;
  }
  const { message, path } = issue as { message?: unknown; path?: unknown };
  if (typeof message !== 'string' || message === '' || !Array.isArray(path)) {
    return DEFAULT_MESSAGE;
  }
  return `${message} (${path.length > 0 ? path.map(String).join('.') : 'Unknown path'})`;
};
