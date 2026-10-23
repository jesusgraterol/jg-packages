import { describe, expect, test } from 'vitest';

import { MAX_DIFF_EDIT_LENGTH, MAX_WORD_LINE_LENGTH } from './constants.ts';
import type { IDiffModel, IDiffSourceLine } from './types.ts';
import { buildDiffModel, splitSourceLines, toHighlightSource } from './utilities.ts';

const sourceText = (lines: IDiffSourceLine[]): string => lines.map(({ raw }) => raw).join('');

/** Reconstructs both full sources through the model, independently of its original source arrays. */
const reconstruct = (model: IDiffModel): { before: string; after: string } => {
  const before: string[] = [];
  const after: string[] = [];
  for (const chunk of model.chunks) {
    if (chunk.type === 'change') {
      before.push(sourceText(chunk.before));
      after.push(sourceText(chunk.after));
    } else if (chunk.type === 'context') {
      const text = sourceText(chunk.lines);
      before.push(text);
      after.push(text);
    }
  }
  return { before: before.join(''), after: after.join('') };
};

describe('source lines', () => {
  test.each([
    ['', []],
    ['\n', [['', 'lf', 1]]],
    [
      '\r\n\r\n',
      [
        ['', 'crlf', 1],
        ['', 'crlf', 2],
      ],
    ],
    [
      'one\rtwo\n世界\r\nlast',
      [
        ['one', 'cr', 1],
        ['two', 'lf', 2],
        ['世界', 'crlf', 3],
        ['last', 'none', 4],
      ],
    ],
  ])('splits %j into real source lines', (source, expected) => {
    const lines = splitSourceLines(source);
    expect(lines.map(({ text, ending, lineNumber }) => [text, ending, lineNumber])).toStrictEqual(
      expected,
    );
    expect(sourceText(lines)).toBe(source);
  });

  test('normalizes only highlighter input and preserves blank-line counts', () => {
    const lines = splitSourceLines('one\r\n\rtwo\nlast');
    expect(toHighlightSource(lines)).toBe('one\n\ntwo\nlast');
    expect(toHighlightSource(splitSourceLines('\n\n'))).toBe('\n\n');
    expect(toHighlightSource([])).toBe('');
    expect(sourceText(lines)).toBe('one\r\n\rtwo\nlast');
  });
});

describe('buildDiffModel', () => {
  test.each([
    ['', ''],
    ['\n', ''],
    ['', '\n'],
    ['a', 'a\n'],
    ['a\r\n', 'a\n'],
    ['first\nrepeat\nrepeat\nlast\n', 'first\nrepeat\nnew\nrepeat\nlast\n'],
    ['old 1\nold 2\nold 3\n', 'new\n'],
    ['old\n', 'new 1\nnew 2\n'],
    ['<script>\r\n世界\r', '<tag>& text\n🌍'],
    ['a\n\nb\n', 'a\n\n\nb\n'],
  ])('represents %j -> %j without omitting or normalizing source', (before, after) => {
    const model = buildDiffModel(before, after);
    expect(reconstruct(model)).toStrictEqual({ before, after });
    expect(model.hasChanges).toBe(before !== after);
    expect(model.isFallback).toBe(false);
  });

  test('has no invented rows for empty sources', () => {
    expect(buildDiffModel('', '')).toStrictEqual({
      beforeLines: [],
      afterLines: [],
      chunks: [],
      isFallback: false,
      hasChanges: false,
    });
  });

  test('keeps independent line numbers after unequal edits', () => {
    const model = buildDiffModel('one\nold\nthree\n', 'one\nnew\nextra\nthree\n');
    expect(model.chunks.map((chunk) => chunk.type)).toStrictEqual(['context', 'change', 'context']);
    expect(model.chunks.at(-1)).toMatchObject({
      type: 'context',
      beforeStart: 3,
      afterStart: 4,
      lines: [{ text: 'three', lineNumber: 4 }],
    });
  });

  test('exhausted edit search becomes a complete before/after replacement', () => {
    const before = Array.from(
      { length: MAX_DIFF_EDIT_LENGTH + 1 },
      (_, index) => `old ${index}\n`,
    ).join('');
    const after = Array.from(
      { length: MAX_DIFF_EDIT_LENGTH + 1 },
      (_, index) => `new ${index}\n`,
    ).join('');
    const model = buildDiffModel(before, after, { highlightWords: true, contextLines: 0 });
    expect(model.isFallback).toBe(true);
    expect(model.chunks.map((chunk) => chunk.type)).toStrictEqual(['change']);
    expect(reconstruct(model)).toStrictEqual({ before, after });
    expect(model.beforeLines.every((line) => line.wordRanges.length === 0)).toBe(true);
  });

  test('handles a large unchanged prefix without spreading source-sized arrays into calls', () => {
    const shared = 'context\n'.repeat(16_384);
    const model = buildDiffModel(`${shared}old\n`, `${shared}new\n`, { contextLines: 1 });
    expect(model.chunks[0]).toStrictEqual({
      type: 'omitted',
      count: 16_383,
      beforeStart: 1,
      afterStart: 1,
    });
    expect(model.chunks.at(-1)).toMatchObject({
      type: 'change',
      before: [{ lineNumber: 16_385 }],
      after: [{ lineNumber: 16_385 }],
    });
  });

  test.each([undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'retains full context for limit %s',
    (contextLines) => {
      const before = 'a\nb\nc\nold\nd\ne\nf\n';
      const after = 'a\nb\nc\nnew\nd\ne\nf\n';
      expect(reconstruct(buildDiffModel(before, after, { contextLines }))).toStrictEqual({
        before,
        after,
      });
    },
  );

  test.each([
    [0, [3, 5, 3]],
    [1, [2, 3, 2]],
    [2, [1, 1, 1]],
    [8, []],
  ])('omits exactly the unchanged intervals at context %d', (contextLines, counts) => {
    const before = 'a\nb\nc\nold\nd\ne\nf\ng\nh\nold 2\ni\nj\nk\n';
    const after = 'a\nb\nc\nnew\nd\ne\nf\ng\nh\nnew 2\ni\nj\nk\n';
    const model = buildDiffModel(before, after, { contextLines });
    expect(
      model.chunks.filter((chunk) => chunk.type === 'omitted').map((chunk) => chunk.count),
    ).toStrictEqual(counts);
    expect(model.chunks.filter((chunk) => chunk.type === 'change')).toHaveLength(2);
  });

  test('labels all omitted lines in an unchanged file without inventing a change', () => {
    const model = buildDiffModel('a\nb\n', 'a\nb\n', { contextLines: 1 });
    expect(model.chunks).toStrictEqual([
      { type: 'omitted', count: 2, beforeStart: 1, afterStart: 1 },
    ]);
    expect(model.hasChanges).toBe(false);
  });
});

describe('word emphasis', () => {
  test('marks exact changed words while retaining Unicode, punctuation, and unpaired source', () => {
    const model = buildDiffModel('const message = "世界";\nextra\n', 'const message = "🌍";\n', {
      highlightWords: true,
    });
    expect(
      model.beforeLines[0]?.wordRanges.map((range) =>
        model.beforeLines[0]?.text.slice(range.start, range.end),
      ),
    ).toStrictEqual(['世界']);
    expect(
      model.afterLines[0]?.wordRanges.map((range) =>
        model.afterLines[0]?.text.slice(range.start, range.end),
      ),
    ).toStrictEqual(['🌍']);
    expect(model.beforeLines[1]?.wordRanges).toStrictEqual([]);
    expect(buildDiffModel('old', 'new').beforeLines[0]?.wordRanges).toStrictEqual([]);
  });

  test.each([MAX_WORD_LINE_LENGTH, MAX_WORD_LINE_LENGTH + 1])(
    'bounds paired line comparison at %d characters',
    (length) => {
      const before = `old${' '.repeat(length - 3)}`;
      const after = `new${' '.repeat(length - 3)}`;
      const model = buildDiffModel(before, after, { highlightWords: true });
      expect(model.beforeLines[0]?.wordRanges).toStrictEqual(
        length === MAX_WORD_LINE_LENGTH ? [{ start: 0, end: 3 }] : [],
      );
      expect(reconstruct(model)).toStrictEqual({ before, after });
    },
  );

  test('falls back to line emphasis when bounded word edit search is exhausted', () => {
    const model = buildDiffModel('old '.repeat(1024), 'new '.repeat(1024), {
      highlightWords: true,
    });
    expect(model.isFallback).toBe(false);
    expect(model.beforeLines[0]?.wordRanges).toStrictEqual([]);
    expect(model.afterLines[0]?.wordRanges).toStrictEqual([]);
  });
});
