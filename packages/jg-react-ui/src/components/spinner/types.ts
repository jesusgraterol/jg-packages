import type * as React from 'react';
import type { LoaderCircle } from 'lucide-react';

/** Spinner props reuse the Lucide icon contract while adding accessible loading defaults.
 * @see Spinner
 */
export type ISpinnerProps = React.ComponentProps<typeof LoaderCircle>;
