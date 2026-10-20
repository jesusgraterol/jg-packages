// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { findMarkedRegion, upsertMarkedRegion } from './marked-region.js';

const MARKERS = { start: '<!-- tool:start -->', end: '<!-- tool:end -->' };
const BLOCK = '<!-- tool:start -->\nnew\n<!-- tool:end -->\n';
const OLD_REGION = '<!-- tool:start -->\nold\n<!-- tool:end -->\n';

describe('findMarkedRegion', () => {
  test('finds the region from its start marker through the end marker line break', () => {
    const text = `# Title\n\n${OLD_REGION}after\n`;

    expect(findMarkedRegion(text, MARKERS)).toStrictEqual({
      start: 9,
      end: 9 + OLD_REGION.length,
      lineEnding: '\n',
    });
  });

  test('reads CRLF documents, and an end marker that ends the document without a line break', () => {
    const text = 'intro\r\n<!-- tool:start -->\r\nold\r\n<!-- tool:end -->';

    expect(findMarkedRegion(text, MARKERS)).toStrictEqual({
      start: 7,
      end: text.length,
      lineEnding: '\r\n',
    });
  });

  test('allows a byte order mark before a start marker on the first line', () => {
    expect(findMarkedRegion(`\ufeff${OLD_REGION}`, MARKERS)).toStrictEqual({
      start: 1,
      end: 1 + OLD_REGION.length,
      lineEnding: '\n',
    });
  });

  test.each(['', '# Title\n', '\ufeff'])('returns null without markers, for %j', (text) => {
    expect(findMarkedRegion(text, MARKERS)).toBeNull();
  });

  test.each([
    ['a marker sharing its line', 'x <!-- tool:start -->\nold\n<!-- tool:end -->\n', 'must fill'],
    [
      'an end marker sharing its line',
      '<!-- tool:start -->\nold\n<!-- tool:end --> x\n',
      'must fill',
    ],
    ['two start markers', `${OLD_REGION}${OLD_REGION}`, 'one start marker'],
    ['two end markers', `${OLD_REGION}<!-- tool:end -->\n`, 'one end marker'],
    ['markers in the wrong order', '<!-- tool:end -->\n<!-- tool:start -->\n', 'before one end'],
    ['a start marker alone', '<!-- tool:start -->\nold\n', 'both region markers'],
    ['an end marker alone', 'old\n<!-- tool:end -->\n', 'both region markers'],
    ['a start marker that ends the document', 'old\n<!-- tool:start -->', 'both region markers'],
    ['a byte order mark on a later line', `a\n\ufeff${OLD_REGION}`, 'must fill'],
  ])('throws INVALID_MARKED_REGION for %s', (_, text, message) => {
    expectToThrowCode(() => findMarkedRegion(text, MARKERS), ERRORS.INVALID_MARKED_REGION, message);
  });

  test.each([
    ['an empty marker', { start: '', end: '<!-- e -->' }],
    ['a marker with a line break', { start: '<!-- s -->\n', end: '<!-- e -->' }],
    ['a marker inside the other', { start: '<!-- x -->', end: '<!-- x -->!' }],
  ])('throws INVALID_MARKED_REGION for %s', (_, markers) => {
    expectToThrowCode(() => findMarkedRegion('text\n', markers), ERRORS.INVALID_MARKED_REGION);
  });
});

describe('upsertMarkedRegion', () => {
  test('replaces the region and keeps everything around it', () => {
    expect(upsertMarkedRegion(`# Title\n\n${OLD_REGION}after\n`, BLOCK, MARKERS)).toBe(
      `# Title\n\n${BLOCK}after\n`,
    );
  });

  test("writes the block with the start marker line's line ending", () => {
    expect(
      upsertMarkedRegion('a\n<!-- tool:start -->\r\nold\n<!-- tool:end -->\nb\n', BLOCK, MARKERS),
    ).toBe('a\n<!-- tool:start -->\r\nnew\r\n<!-- tool:end -->\r\nb\n');
  });

  test('keeps a byte order mark before the region', () => {
    expect(upsertMarkedRegion(`\ufeff${OLD_REGION}`, BLOCK, MARKERS)).toBe(`\ufeff${BLOCK}`);
  });

  test.each([
    ['an empty document', '', BLOCK],
    ['a byte order mark alone', '\ufeff', `\ufeff${BLOCK}`],
    ['a document ending with a line break', '# Title\n', `# Title\n\n${BLOCK}`],
    ['a document without a final line break', '# Title', `# Title\n\n${BLOCK}`],
    [
      'a CRLF document',
      '# Title\r\ntext\r\n',
      '# Title\r\ntext\r\n\r\n<!-- tool:start -->\r\nnew\r\n<!-- tool:end -->\r\n',
    ],
    ['a document mixing LF and CRLF', '# Title\r\ntext\n', `# Title\r\ntext\n\n${BLOCK}`],
  ])('appends to %s after one blank line', (_, text, expected) => {
    expect(upsertMarkedRegion(text, BLOCK, MARKERS)).toBe(expected);
  });

  test.each([
    ['a block with CRLF', '<!-- tool:start -->\r\nnew\r\n<!-- tool:end -->\r\n'],
    ['a block without a final line break', '<!-- tool:start -->\nnew\n<!-- tool:end -->'],
    ['a block with text before its start marker', `intro\n${BLOCK}`],
    ['a block with text after its end marker', `${BLOCK}more\n`],
    ['a block without markers', 'just text\n'],
    ['a block with two regions', `${BLOCK}${BLOCK}`],
  ])('throws INVALID_MARKED_REGION for %s', (_, block) => {
    expectToThrowCode(
      () => upsertMarkedRegion('# Title\n', block, MARKERS),
      ERRORS.INVALID_MARKED_REGION,
    );
  });

  test("throws INVALID_MARKED_REGION for a document whose markers aren't valid", () => {
    expectToThrowCode(
      () => upsertMarkedRegion(`${OLD_REGION}${OLD_REGION}`, BLOCK, MARKERS),
      ERRORS.INVALID_MARKED_REGION,
    );
  });
});
