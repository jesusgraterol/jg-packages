import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import type { IMarkedRegion, IRegionMarkers } from './types.js';

// the byte order mark a document's first line may start with
const BYTE_ORDER_MARK = '﻿';

/**
 * Throws the error for a document, a block, or markers that don't form one valid region.
 * @param problem What's wrong.
 * @throws
 * - INVALID_MARKED_REGION: always
 */
const throwInvalidRegion = (problem: string): never => {
  throw new Exception(problem, { code: ERRORS.INVALID_MARKED_REGION });
};

/**
 * Ensures the markers are two different single lines, neither inside the other.
 * @param markers The markers.
 * @throws
 * - INVALID_MARKED_REGION: if they aren't
 */
const validateMarkers = ({ start, end }: IRegionMarkers): void => {
  for (const marker of [start, end]) {
    if (typeof marker !== 'string' || marker === '' || /[\r\n]/.test(marker)) {
      throwInvalidRegion('Each region marker must be a non-empty single line.');
    }
  }
  if (start.includes(end) || end.includes(start)) {
    throwInvalidRegion('Neither region marker may contain the other.');
  }
};

/**
 * Finds the region between two marker lines in a document, such as the part of a README a tool
 * keeps up to date between `<!-- tool:start -->` and `<!-- tool:end -->`. Each marker must fill
 * its whole line, apart from a byte order mark before the first line, and the document must hold
 * exactly one of each, the start first. Lines may end with LF or CRLF.
 * @param text The document.
 * @param markers The start and end marker lines.
 * @returns The region, from its start marker through the end marker's line break, with the start
 * marker line's line ending, or null when the document has neither marker.
 * @example
 * import { findMarkedRegion } from 'jg-utilities';
 *
 * const markers = { start: '<!-- tool:start -->', end: '<!-- tool:end -->' };
 * findMarkedRegion('# Title\n<!-- tool:start -->\nold\n<!-- tool:end -->\n', markers); // => { start: 8, end: 50, lineEnding: '\n' }
 * findMarkedRegion('# Title\n', markers); // => null
 * @throws
 * - INVALID_MARKED_REGION: if a marker shares its line with other text, appears twice or without
 * the other, or the end marker comes first
 */
export const findMarkedRegion = (text: string, markers: IRegionMarkers): IMarkedRegion | null => {
  validateMarkers(markers);
  let start: { offset: number; lineEnding: '\n' | '\r\n' } | undefined;
  let end: number | undefined;
  let lineStart = 0;
  while (lineStart < text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline + 1;
    const hasCarriageReturn = newline > lineStart && text[newline - 1] === '\r';
    const contentEnd = newline === -1 ? text.length : newline - (hasCarriageReturn ? 1 : 0);
    const contentStart =
      lineStart === 0 && text.startsWith(BYTE_ORDER_MARK) ? BYTE_ORDER_MARK.length : lineStart;
    const content = text.slice(contentStart, contentEnd);
    for (const kind of ['start', 'end'] as const) {
      if (!content.includes(markers[kind])) {
        continue;
      }
      if (content !== markers[kind]) {
        throwInvalidRegion(`The ${kind} marker must fill its whole line.`);
      }
      if (kind === 'start') {
        if (start !== undefined || end !== undefined) {
          throwInvalidRegion('The document must hold one start marker, before one end marker.');
        }
        // a start marker on the last line has no end marker after it, which fails below
        start = { offset: contentStart, lineEnding: hasCarriageReturn ? '\r\n' : '\n' };
      } else {
        if (end !== undefined) {
          throwInvalidRegion('The document must hold one end marker.');
        }
        end = lineEnd;
      }
    }
    lineStart = lineEnd;
  }
  if (start === undefined && end === undefined) {
    return null;
  }
  if (start === undefined || end === undefined) {
    return throwInvalidRegion('The document must hold both region markers, or neither.');
  }
  return { start: start.offset, end, lineEnding: start.lineEnding };
};

/**
 * Puts a block into a document between its markers: it replaces the region `findMarkedRegion`
 * finds, using the start marker line's line ending, or appends the block when the document has
 * no markers, after a blank line, using CRLF only when every line break of the document is CRLF.
 * Everything outside the region, a byte order mark included, stays as it was.
 * @param text The document.
 * @param block The new region: the start marker line, the content, and the end marker line, with
 * LF line breaks and ending with one.
 * @param markers The start and end marker lines.
 * @returns The updated document.
 * @example
 * import { upsertMarkedRegion } from 'jg-utilities';
 *
 * const markers = { start: '<!-- tool:start -->', end: '<!-- tool:end -->' };
 * const block = '<!-- tool:start -->\nnew\n<!-- tool:end -->\n';
 * upsertMarkedRegion('# Title\n', block, markers); // => '# Title\n\n<!-- tool:start -->\nnew\n<!-- tool:end -->\n'
 * upsertMarkedRegion('a\r\n<!-- tool:start -->\r\nold\r\n<!-- tool:end -->\r\nb\r\n', block, markers); // => 'a\r\n<!-- tool:start -->\r\nnew\r\n<!-- tool:end -->\r\nb\r\n'
 * @throws
 * - INVALID_MARKED_REGION: if the block isn't one region that ends with a line break, uses CRLF,
 * or the document's markers are invalid, as for `findMarkedRegion`
 */
export const upsertMarkedRegion = (
  text: string,
  block: string,
  markers: IRegionMarkers,
): string => {
  validateMarkers(markers);
  if (typeof block !== 'string' || block.includes('\r') || !block.endsWith('\n')) {
    throwInvalidRegion('The block must use LF line breaks and end with one.');
  }
  const blockRegion = findMarkedRegion(block, markers);
  if (blockRegion === null || blockRegion.start !== 0 || blockRegion.end !== block.length) {
    throwInvalidRegion(
      'The block must be exactly one region, from its start marker line to its end marker line.',
    );
  }
  const region = findMarkedRegion(text, markers);
  if (region !== null) {
    return `${text.slice(0, region.start)}${block.replaceAll('\n', region.lineEnding)}${text.slice(region.end)}`;
  }
  const lineBreaks = text.split('\n').length - 1;
  const lineEnding = lineBreaks > 0 && text.split('\r\n').length - 1 === lineBreaks ? '\r\n' : '\n';
  const isEmpty = text === '' || text === BYTE_ORDER_MARK;
  const separator = isEmpty ? '' : `${text.endsWith('\n') ? '' : lineEnding}${lineEnding}`;
  return `${text}${separator}${block.replaceAll('\n', lineEnding)}`;
};
