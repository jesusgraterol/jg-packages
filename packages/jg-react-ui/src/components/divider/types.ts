import type * as React from 'react';
import type { Separator as BaseSeparator } from '@base-ui/react/separator';

/** Divider props expose the shared decorative option with Base UI separator behavior.
 * @see Divider
 */
export type IDividerProps = React.ComponentProps<typeof BaseSeparator> & {
  decorative?: boolean;
};
