import type { ThemedToken } from 'shiki';

import { escapeHtml } from '../../html/index.ts';
import { renderLineTokens } from '../../highlighting/index.ts';

import type { IDiffMarkup, IDiffModel, IDiffRenderedRow, IDiffSourceLine } from './types.ts';

// source markers remain decorative; text labels announce each changed line's meaning
const LINE_STYLES = {
  added: { marker: '+', classes: 'bg-diff-added', label: 'Added line: ' },
  context: { marker: ' ', classes: '', label: '' },
  removed: { marker: '−', classes: 'bg-diff-removed', label: 'Removed line: ' },
} as const;

/** Renders word ranges through the existing token renderer, so source never becomes trusted HTML. */
const renderSource = (line: IDiffSourceLine, tokens: ThemedToken[] | undefined): string => {
  if (tokens === undefined) return escapeHtml(line.text);
  if (line.wordRanges.length === 0) return renderLineTokens(tokens);
  const fragments: string[] = [];
  let offset = 0;
  let rangeIndex = 0;
  for (const token of tokens) {
    let local = 0;
    while (local < token.content.length) {
      const start = offset + local;
      let range = line.wordRanges[rangeIndex];
      while (range !== undefined && range.end <= start) {
        rangeIndex += 1;
        range = line.wordRanges[rangeIndex];
      }
      const isChanged = range !== undefined && range.start <= start;
      const boundary =
        range === undefined ? offset + token.content.length : isChanged ? range.end : range.start;
      const end = Math.min(token.content.length, boundary - offset);
      const html = renderLineTokens([{ ...token, content: token.content.slice(local, end) }]);
      fragments.push(isChanged ? `<mark class="jg-diff-word">${html}</mark>` : html);
      local = end;
    }
    offset += token.content.length;
  }
  return fragments.join('');
};

/** Builds the source body once per representation, with optional original line-number gutters. */
const renderLine = (
  line: IDiffSourceLine | undefined,
  kind: keyof typeof LINE_STYLES,
  tokens: ThemedToken[] | undefined,
  numbers: (number | undefined)[],
  options: { lineNumbers: boolean; wrap: boolean; endingRow: boolean },
): string => {
  const style = LINE_STYLES[kind];
  if (line === undefined)
    return `<span class="jg-diff-entry bg-secondary/40" aria-hidden="true"><span class="jg-diff-line"> </span>${options.endingRow ? '<span class="jg-diff-ending"> </span>' : ''}</span>`;
  const gutters = options.lineNumbers
    ? numbers
        .map((number) => `<span class="jg-diff-number" aria-hidden="true">${number ?? ''}</span>`)
        .join('')
    : '';
  const numberLabel = options.lineNumbers
    ? numbers
        .map((number, index) =>
          number === undefined
            ? ''
            : `${numbers.length === 2 ? (index === 0 ? 'Before line' : 'After line') : 'Line'} ${number}. `,
        )
        .join('')
    : '';
  const ending = line.ending === 'none' ? 'No newline at end of file' : '';
  const endingHtml = options.endingRow
    ? `<span class="jg-diff-ending"${ending === '' ? ' aria-hidden="true"' : ''}>${ending || ' '}</span>`
    : '';
  const html = renderSource(line, tokens);
  return `<span class="jg-diff-entry ${style.classes}" data-diff-kind="${kind}" data-line-ending="${line.ending}"><span class="jg-diff-line${options.wrap ? ' jg-diff-line-wrap' : ''}">${gutters}<span class="jg-diff-marker" aria-hidden="true">${style.marker}</span><span class="sr-only select-none">${numberLabel}${style.label}</span><span class="jg-diff-source">${html === '' ? ' ' : html}</span></span>${endingHtml}</span>`;
};

/**
 * Renders every representation from the same model and shared build-time highlighting.
 * @param model The exact comparison and source intervals.
 * @param beforeTokens The original source's highlighted lines.
 * @param afterTokens The resulting source's highlighted lines.
 * @param options The additive line-number and overflow presentation.
 * @returns Unified markup and paired rows, including honest omission notices.
 */
export const renderDiffMarkup = (
  model: IDiffModel,
  beforeTokens: ThemedToken[][],
  afterTokens: ThemedToken[][],
  options: { lineNumbers?: boolean | undefined; overflow?: 'scroll' | 'wrap' | undefined } = {},
): IDiffMarkup => {
  const unified: string[] = [];
  const rows: IDiffRenderedRow[] = [];
  const presentation = {
    lineNumbers: options.lineNumbers === true,
    wrap: options.overflow === 'wrap',
    endingRow: false,
  };
  for (const chunk of model.chunks) {
    if (chunk.type === 'omitted') {
      const html = `<span class="jg-diff-omitted" data-diff-omitted="${chunk.count}">${chunk.count} unchanged ${chunk.count === 1 ? 'line' : 'lines'} omitted</span>`;
      unified.push(html);
      rows.push({ before: html, after: html, isOmitted: true });
      continue;
    }
    if (chunk.type === 'context') {
      for (const [index, line] of chunk.lines.entries()) {
        const beforeNumber = chunk.beforeStart + index;
        const endingRow = line.ending === 'none';
        unified.push(
          renderLine(
            line,
            'context',
            afterTokens[line.lineNumber - 1],
            [beforeNumber, line.lineNumber],
            { ...presentation, endingRow },
          ),
        );
        rows.push({
          before: renderLine(line, 'context', beforeTokens[beforeNumber - 1], [beforeNumber], {
            ...presentation,
            endingRow,
          }),
          after: renderLine(line, 'context', afterTokens[line.lineNumber - 1], [line.lineNumber], {
            ...presentation,
            endingRow,
          }),
          isOmitted: false,
        });
      }
      continue;
    }
    for (const line of chunk.before)
      unified.push(
        renderLine(
          line,
          'removed',
          beforeTokens[line.lineNumber - 1],
          [line.lineNumber, undefined],
          { ...presentation, endingRow: line.ending === 'none' },
        ),
      );
    for (const line of chunk.after)
      unified.push(
        renderLine(line, 'added', afterTokens[line.lineNumber - 1], [undefined, line.lineNumber], {
          ...presentation,
          endingRow: line.ending === 'none',
        }),
      );
    for (let index = 0; index < Math.max(chunk.before.length, chunk.after.length); index += 1) {
      const before = chunk.before[index];
      const after = chunk.after[index];
      const endingRow = before?.ending === 'none' || after?.ending === 'none';
      rows.push({
        before: renderLine(
          before,
          'removed',
          beforeTokens[(before?.lineNumber ?? 0) - 1],
          [before?.lineNumber],
          { ...presentation, endingRow },
        ),
        after: renderLine(
          after,
          'added',
          afterTokens[(after?.lineNumber ?? 0) - 1],
          [after?.lineNumber],
          { ...presentation, endingRow },
        ),
        isOmitted: false,
      });
    }
  }
  return { unified: unified.join(''), rows };
};
