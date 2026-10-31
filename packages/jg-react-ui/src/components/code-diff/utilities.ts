import type { ReactDiffViewerProps } from 'react-diff-viewer-continued';

import type { ICodeDiffHighlightStyle } from './code-highlighting.js';
import {
  CODE_DIFF_SYNC_MAX_CHARACTERS,
  CODE_DIFF_SYNC_MAX_LINES,
  DEFAULT_CODE_DIFF_STYLES,
} from './constants.js';
import type { ICodeDiffInterpolationKey } from './types.js';

/**
 * Avoids worker startup for bounded excerpts without moving large comparisons onto the UI thread.
 * @param oldValue The original source.
 * @param newValue The candidate source.
 * @returns Whether both revisions fit the synchronous computation budget.
 */
export const canComputeCodeDiffSynchronously = (oldValue: string, newValue: string): boolean => {
  if (oldValue.length + newValue.length > CODE_DIFF_SYNC_MAX_CHARACTERS) {
    return false;
  }

  let lineCount = 2;
  for (const source of [oldValue, newValue]) {
    for (let index = 0; index < source.length; index += 1) {
      const character = source.charCodeAt(index);
      if (character === 10 || (character === 13 && source.charCodeAt(index + 1) !== 10)) {
        lineCount += 1;
        if (lineCount > CODE_DIFF_SYNC_MAX_LINES) {
          return false;
        }
      }
    }
  }
  return true;
};

/**
 * Removes theme backgrounds from syntax-highlighting tokens so diff row states remain visible.
 * @param highlightStyle The Prism style map resolved for the current theme.
 * @returns A style map that preserves token colors without replacing diff row backgrounds.
 */
export const normalizeCodeDiffHighlightStyle = (
  highlightStyle: ICodeDiffHighlightStyle,
): ICodeDiffHighlightStyle =>
  Object.fromEntries(
    Object.entries(highlightStyle).map(([selector, styleValue]) => [
      selector,
      {
        ...styleValue,
        background: 'transparent',
        textShadow: 'none',
      },
    ]),
  );

/**
 * Combines wrapper defaults with consumer-provided emotion style overrides.
 * @param defaultStyle The shared code diff interpolation.
 * @param style The consumer override for the same key.
 * @returns A merged emotion interpolation that preserves the shared defaults.
 */
const mergeStyleInterpolation = <TKey extends ICodeDiffInterpolationKey>(
  defaultStyle: NonNullable<ReactDiffViewerProps['styles']>[TKey] | undefined,
  style: NonNullable<ReactDiffViewerProps['styles']>[TKey] | undefined,
): NonNullable<ReactDiffViewerProps['styles']>[TKey] | undefined => {
  if (style === undefined) {
    return defaultStyle;
  }

  return [defaultStyle, style] as NonNullable<ReactDiffViewerProps['styles']>[TKey];
};

/**
 * Keeps both unified and split diff tables constrained to the component frame.
 * @returns The fixed table layout used by wrapped diff content.
 */
const getCodeDiffContainerLayoutStyle = (): NonNullable<
  ReactDiffViewerProps['styles']
>['diffContainer'] => ({
  minWidth: '100%',
  tableLayout: 'fixed',
  width: '100%',
  pre: {
    minWidth: 0,
    width: '100%',
  },
});

/**
 * Prevents wrapped cell content from expanding the fixed diff table.
 * @returns The constrained cell layout shared by both diff views.
 */
const getCodeDiffCellLayoutStyle = (): NonNullable<ReactDiffViewerProps['styles']>['content'] => ({
  overflow: 'hidden',
  width: '100%',
});

/**
 * Wraps long lines inside their own unified or split diff cell.
 * @returns The content style interpolation for always-wrapped lines.
 */
const getCodeDiffContentTextStyle = (): NonNullable<
  ReactDiffViewerProps['styles']
>['contentText'] => ({
  display: 'block',
  minWidth: 0,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  width: '100%',
  wordBreak: 'break-word',
});

/**
 * Resolves the final style override map passed to the diff viewer.
 * @param styles Optional consumer-provided style overrides.
 * @returns A style override object that keeps the wrapper defaults and merges user overrides.
 */
export const resolveCodeDiffStyles = (
  styles?: ReactDiffViewerProps['styles'],
): NonNullable<ReactDiffViewerProps['styles']> => ({
  ...styles,
  variables: {
    light: {
      ...DEFAULT_CODE_DIFF_STYLES.variables?.light,
      ...styles?.variables?.light,
    },
    dark: {
      ...DEFAULT_CODE_DIFF_STYLES.variables?.dark,
      ...styles?.variables?.dark,
    },
  },
  diffContainer: mergeStyleInterpolation(
    mergeStyleInterpolation(
      DEFAULT_CODE_DIFF_STYLES.diffContainer,
      getCodeDiffContainerLayoutStyle(),
    ),
    styles?.diffContainer,
  ),
  summary: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.summary, styles?.summary),
  titleBlock: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.titleBlock, styles?.titleBlock),
  line: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.line, styles?.line),
  content: mergeStyleInterpolation(
    mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.content, getCodeDiffCellLayoutStyle()),
    styles?.content,
  ),
  lineContent: mergeStyleInterpolation(
    mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.lineContent, getCodeDiffCellLayoutStyle()),
    styles?.lineContent,
  ),
  contentText: mergeStyleInterpolation(
    mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.contentText, getCodeDiffContentTextStyle()),
    styles?.contentText,
  ),
  gutter: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.gutter, styles?.gutter),
  lineNumber: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.lineNumber, styles?.lineNumber),
  marker: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.marker, styles?.marker),
  wordDiff: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.wordDiff, styles?.wordDiff),
  wordAdded: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.wordAdded, styles?.wordAdded),
  wordRemoved: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.wordRemoved, styles?.wordRemoved),
  codeFoldGutter: mergeStyleInterpolation(
    DEFAULT_CODE_DIFF_STYLES.codeFoldGutter,
    styles?.codeFoldGutter,
  ),
  codeFoldContentContainer: mergeStyleInterpolation(
    DEFAULT_CODE_DIFF_STYLES.codeFoldContentContainer,
    styles?.codeFoldContentContainer,
  ),
  codeFoldExpandButton: mergeStyleInterpolation(
    DEFAULT_CODE_DIFF_STYLES.codeFoldExpandButton,
    styles?.codeFoldExpandButton,
  ),
  codeFold: mergeStyleInterpolation(DEFAULT_CODE_DIFF_STYLES.codeFold, styles?.codeFold),
  allExpandButton: mergeStyleInterpolation(
    DEFAULT_CODE_DIFF_STYLES.allExpandButton,
    styles?.allExpandButton,
  ),
});
