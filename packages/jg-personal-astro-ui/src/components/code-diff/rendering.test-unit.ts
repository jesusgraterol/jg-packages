import { describe, expect, test } from 'vitest';

import { highlightToLines } from '../../highlighting/index.ts';

import { renderDiffMarkup } from './rendering.ts';
import { buildDiffModel, toHighlightSource } from './utilities.ts';

describe('renderDiffMarkup', () => {
  test('retains highlighted unchanged context and empty lines around a word-only change', async () => {
    const model = buildDiffModel(
      'same\n\nalpha beta gamma\nlast\n',
      'same\n\nalpha gamma\nlast\n',
      { highlightWords: true },
    );
    const before = await highlightToLines(toHighlightSource(model.beforeLines), 'text');
    const after = await highlightToLines(toHighlightSource(model.afterLines), 'text');
    const markup = renderDiffMarkup(model, before, after);
    expect(markup.unified).toContain('same');
    expect(markup.unified).toContain('<mark class="jg-diff-word">');
    expect(markup.unified).toContain('last');
    expect(markup.rows).toHaveLength(4);
    expect(markup.rows[1]?.before).toContain('jg-diff-source"> </span>');
  });
  test('preserves token colors and escaped source while emphasizing only changed words', async () => {
    const model = buildDiffModel('const message = "<old>";\n', 'const message = "<new>";\n', {
      highlightWords: true,
    });
    const before = await highlightToLines(toHighlightSource(model.beforeLines), 'ts');
    const after = await highlightToLines(toHighlightSource(model.afterLines), 'ts');
    const markup = renderDiffMarkup(model, before, after, { lineNumbers: true, overflow: 'wrap' });
    expect(markup.unified).toContain('data-diff-kind="removed"');
    expect(markup.unified).toContain('data-diff-kind="added"');
    expect(markup.unified).toContain('var(--jg-syntax-');
    expect(markup.unified).toContain('<mark class="jg-diff-word"><span');
    expect(markup.unified).not.toContain('<old>');
    expect(markup.unified).not.toContain('<new>');
    expect(markup.rows).toHaveLength(1);
    expect(markup.rows[0]?.before).toContain('Removed line: ');
    expect(markup.rows[0]?.after).toContain('Added line: ');
  });

  test('represents unequal changes, empty source lines, and final-newline notices with aligned placeholders', () => {
    const model = buildDiffModel('old\n\nlast', 'new\n');
    const markup = renderDiffMarkup(model, [], [], { lineNumbers: true });
    expect(markup.rows).toHaveLength(3);
    expect(markup.unified).toContain('No newline at end of file');
    expect(markup.rows[2]?.before).toContain('No newline at end of file');
    expect(markup.rows[2]?.after).toContain('jg-diff-ending');
    expect(markup.rows[2]?.after).toContain('aria-hidden="true"');
    const added = renderDiffMarkup(buildDiffModel('', 'new'), [], []);
    expect(added.rows[0]?.before).toContain('jg-diff-ending');
    const endingChange = renderDiffMarkup(buildDiffModel('old', 'new\n'), [], []);
    expect(endingChange.rows[0]?.before).toContain('No newline at end of file');
    expect(endingChange.rows[0]?.after).toContain('jg-diff-ending" aria-hidden="true"> </span>');
  });

  test('keeps context numbering and exact singular/plural omission notices in every view', () => {
    const model = buildDiffModel('a\nb\nold\nc\nd', 'a\nb\nnew\nextra\nc\nd', { contextLines: 1 });
    const markup = renderDiffMarkup(model, [], [], { lineNumbers: true });
    expect(markup.unified).toContain('1 unchanged line omitted');
    // the final unchanged line is omitted, so its newline notice is omitted with it
    expect(markup.unified).not.toContain('No newline at end of file');
    expect(markup.rows.filter((row) => row.isOmitted)).toHaveLength(2);
    expect(markup.rows.at(-2)?.before).toContain('>4</span>');
    expect(markup.rows.at(-2)?.after).toContain('>5</span>');
    expect(
      renderDiffMarkup(buildDiffModel('a\nb\nc', 'a\nb\nc', { contextLines: 0 }), [], []).unified,
    ).toContain('3 unchanged lines omitted');
  });

  test('renders genuinely empty files without invented code rows', () => {
    expect(renderDiffMarkup(buildDiffModel('', ''), [], [])).toStrictEqual({
      unified: '',
      rows: [],
    });
  });
});
