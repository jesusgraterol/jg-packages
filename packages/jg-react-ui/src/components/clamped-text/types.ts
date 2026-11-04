import type * as React from 'react';

import type { CLAMPED_TEXT_LINE_CLASS_NAMES } from './constants.js';

/** The lines a clamped text shows until Show all.
 * @see ClampedText
 */
export type IClampedTextLines = keyof typeof CLAMPED_TEXT_LINE_CLASS_NAMES;

/** Options for ClampedText: the text, its lines, its expansion, and what shows beside the toggle.
 * @see ClampedText
 */
export type IClampedTextProps = {
  children: string;
  // the lines it shows until Show all. Defaults to 3
  lines?: IClampedTextLines;
  // whether it shows in full, for a list that keeps each row's state; it keeps its own otherwise
  isExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
  // what shows in the toggle's row, before it, such as a status
  details?: React.ReactNode;
  // the wrapper's classes, whose text styles the toggle's row takes
  className?: string;
  // the text's classes, such as its size, color and leading
  textClassName?: string;
  expandLabel?: string;
  collapseLabel?: string;
  id?: string;
};
