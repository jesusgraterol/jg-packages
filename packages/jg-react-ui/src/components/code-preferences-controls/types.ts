import type { ICodeDiffView } from '../../contracts/index.js';

/** Code preference controls render only the preference groups enabled by their parent surface.
 * @see CodePreferencesControls
 */
export type ICodePreferencesControlsProps = {
  canChangeCodeDiffView?: boolean | undefined;
  canChangePrefersWrappedCode?: boolean | undefined;
  className?: string | undefined;
  codeDiffView?: ICodeDiffView | undefined;
  isInline?: boolean | undefined;
  prefersWrappedCode: boolean;
};
