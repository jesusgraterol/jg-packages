import type * as React from 'react';

import type { ICodeBlockProps } from '../types.js';

/** Source and diff headers share file metadata while their owners supply controls.
 * @see CodeFileHeader
 */
export type ICodeFileHeaderProps = React.ComponentProps<'div'> &
  Pick<
    ICodeBlockProps,
    'filePath' | 'headerLabel' | 'headerRole' | 'headerMeta' | 'fileIcon' | 'fileStatus'
  > & {
    actions?: React.ReactNode | undefined;
    languageLabel?: string | undefined;
  };
