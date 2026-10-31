import type { ReactDiffViewerProps } from 'react-diff-viewer-continued';

import type { IBreakpoint } from 'jg-react';

import type { ICodeDiffView } from '../../contracts/index.js';

import type { ICodeBlockProps } from '../typography/index.js';

import type { CODE_DIFF_LANGUAGES } from './constants.js';

/** Supported languages registered by the diff highlighter.
 * @see CodeDiff
 */
export type ICodeDiffLanguage = keyof typeof CODE_DIFF_LANGUAGES;

/** Viewer controls with package-owned syntax, theme, and responsive layout.
 * @see CodeDiff
 */
export type ICodeDiffProps = Omit<
  ReactDiffViewerProps,
  'compareMethod' | 'oldValue' | 'newValue' | 'renderContent' | 'useDarkTheme' | 'splitView'
> &
  Pick<ICodeBlockProps, 'filePath' | 'fileIcon' | 'fileStatus' | 'headerLabel' | 'headerMeta'> & {
    className?: string;
    // keyboard focus belongs to the scrolling content beneath the stationary file header
    tabIndex?: number;
    codeDiffView?: ICodeDiffView;
    language?: ICodeDiffLanguage;
    newValue: string;
    oldValue: string;
    responsiveBreakpoint?: IBreakpoint;
  };

// style interpolation keys exclude theme variables because they are merged separately.
export type ICodeDiffInterpolationKey = Exclude<
  keyof NonNullable<ReactDiffViewerProps['styles']>,
  'variables'
>;
