import type * as React from 'react';

import type { TEXT_LINK_VARIANT_CLASS_NAMES } from './constants.js';

/** Text-link props preserve native anchor behavior and support slotted router links.
 * @see TextLink
 */
export type ITextLinkVariant = keyof typeof TEXT_LINK_VARIANT_CLASS_NAMES;
/** Native props for ITextLinkProps, retaining the source component contract.
 * @see TextLink
 */
export type ITextLinkProps = React.ComponentProps<'a'> & {
  asChild?: boolean;
  variant?: ITextLinkVariant;
};
