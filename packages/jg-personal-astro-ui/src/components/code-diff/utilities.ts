import { diffArrays, diffWordsWithSpace } from 'diff';

import { MAX_DIFF_EDIT_LENGTH, MAX_WORD_LINE_LENGTH } from './constants.ts';
import type {
  IDiffChange,
  IDiffChunk,
  IDiffContext,
  IDiffModel,
  IDiffSourceLine,
} from './types.ts';

/** Splits real source lines without inventing a line for an empty file or a final newline. */
export const splitSourceLines = (source: string): IDiffSourceLine[] =>
  (source.match(/[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$/gu) ?? []).map((raw, index) => {
    const ending = raw.endsWith('\r\n')
      ? 'crlf'
      : raw.endsWith('\n')
        ? 'lf'
        : raw.endsWith('\r')
          ? 'cr'
          : 'none';
    const length = ending === 'none' ? 0 : ending === 'crlf' ? 2 : 1;
    return {
      raw,
      text: raw.slice(0, raw.length - length),
      ending,
      lineNumber: index + 1,
      wordRanges: [],
    };
  });

/** Normalizes only the highlighter's input, preserving the number of real source lines. */
export const toHighlightSource = (lines: IDiffSourceLine[]): string =>
  lines.map(({ text, ending }) => text + (ending === 'none' ? '' : '\n')).join('');

/** Marks changed words only for a bounded pair; exhaustion falls back to ordinary line emphasis. */
const highlightPair = (before: IDiffSourceLine, after: IDiffSourceLine): void => {
  if (Math.max(before.text.length, after.text.length) > MAX_WORD_LINE_LENGTH) return;
  const words = diffWordsWithSpace(before.text, after.text, {
    maxEditLength: MAX_DIFF_EDIT_LENGTH,
  });
  if (words === undefined) return;
  let beforeOffset = 0;
  let afterOffset = 0;
  for (const word of words) {
    if (word.removed) {
      before.wordRanges.push({ start: beforeOffset, end: beforeOffset + word.value.length });
      beforeOffset += word.value.length;
    } else if (word.added) {
      after.wordRanges.push({ start: afterOffset, end: afterOffset + word.value.length });
      afterOffset += word.value.length;
    } else {
      beforeOffset += word.value.length;
      afterOffset += word.value.length;
    }
  }
};

/** Keeps context adjacent to changes and replaces every other unchanged interval with its count. */
const reduceContext = (chunks: IDiffChunk[], contextLines: number | undefined): IDiffChunk[] => {
  // malformed caller configuration retains all source rather than silently dropping lines
  if (contextLines === undefined || !Number.isSafeInteger(contextLines) || contextLines < 0)
    return chunks;
  const result: IDiffChunk[] = [];
  for (const [index, chunk] of chunks.entries()) {
    if (chunk.type !== 'context') {
      result.push(chunk);
      continue;
    }
    const head = index === 0 ? 0 : Math.min(contextLines, chunk.lines.length);
    const tail =
      index === chunks.length - 1 ? 0 : Math.min(contextLines, chunk.lines.length - head);
    const omitted = chunk.lines.length - head - tail;
    if (omitted === 0) {
      result.push(chunk);
      continue;
    }
    if (head > 0) result.push({ ...chunk, lines: chunk.lines.slice(0, head) });
    result.push({
      type: 'omitted',
      count: omitted,
      beforeStart: chunk.beforeStart + head,
      afterStart: chunk.afterStart + head,
    });
    if (tail > 0) {
      const offset = chunk.lines.length - tail;
      result.push({
        ...chunk,
        beforeStart: chunk.beforeStart + offset,
        afterStart: chunk.afterStart + offset,
        lines: chunk.lines.slice(offset),
      });
    }
  }
  return result;
};

/**
 * Computes an exact, bounded line comparison with optional local word emphasis and context reduction.
 * Line endings participate in equality. Exhausting edit search produces a truthful full replacement.
 * @param beforeSource The original source.
 * @param afterSource The resulting source.
 * @param options Optional context and word emphasis.
 * @returns The source lines and shared model used by both rendered views.
 */
export const buildDiffModel = (
  beforeSource: string,
  afterSource: string,
  options: { contextLines?: number | undefined; highlightWords?: boolean | undefined } = {},
): IDiffModel => {
  const beforeLines = splitSourceLines(beforeSource);
  const afterLines = splitSourceLines(afterSource);
  const changes = diffArrays(
    beforeLines.map(({ raw }) => raw),
    afterLines.map(({ raw }) => raw),
    { maxEditLength: MAX_DIFF_EDIT_LENGTH },
  );
  const chunks: IDiffChunk[] = [];
  if (changes === undefined) {
    // no approximate matches: every original line is removed, and every resulting line is added
    chunks.push({ type: 'change', before: beforeLines, after: afterLines });
  } else {
    let beforeIndex = 0;
    let afterIndex = 0;
    let pending: IDiffChange = { type: 'change', before: [], after: [] };
    const flush = (): void => {
      if (pending.before.length > 0 || pending.after.length > 0) chunks.push(pending);
      pending = { type: 'change', before: [], after: [] };
    };
    for (const change of changes) {
      const count = change.value.length;
      if (change.removed) {
        for (const line of beforeLines.slice(beforeIndex, beforeIndex + count))
          pending.before.push(line);
        beforeIndex += count;
      } else if (change.added) {
        for (const line of afterLines.slice(afterIndex, afterIndex + count))
          pending.after.push(line);
        afterIndex += count;
      } else {
        flush();
        const context: IDiffContext = {
          type: 'context',
          beforeStart: beforeIndex + 1,
          afterStart: afterIndex + 1,
          lines: afterLines.slice(afterIndex, afterIndex + count),
        };
        chunks.push(context);
        beforeIndex += count;
        afterIndex += count;
      }
    }
    flush();
  }
  if (options.highlightWords === true && changes !== undefined) {
    for (const chunk of chunks) {
      if (chunk.type !== 'change') continue;
      for (const [index, before] of chunk.before.entries()) {
        const after = chunk.after[index];
        if (after !== undefined) highlightPair(before, after);
      }
    }
  }
  return {
    beforeLines,
    afterLines,
    chunks: reduceContext(chunks, options.contextLines),
    isFallback: changes === undefined,
    hasChanges: beforeSource !== afterSource,
  };
};
