import { useMemo, useSyncExternalStore } from 'react';
import type * as React from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from 'lucide-react';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from 'cnfast';

import { IconTile } from '../icon-tile/index.js';
import { useTheme } from '../theme-provider/index.js';
import {
  TOASTR_DEFAULT_ACCENT_COLORS,
  TOASTR_MAX_Z_INDEX,
  TOASTR_PORTAL_STYLE,
  TOASTR_STYLE,
} from './constants.js';
import type { IToastrProps } from './types.js';
import { mergeToastrClassNames } from './utilities.js';

const subscribeToDocument = () => () => {};
const getDocumentSnapshot = () => typeof document !== 'undefined';
const getServerSnapshot = () => false;

/**
 * Renders the shared toastr host with consumer theme tokens and status icon tiles.
 * @param props Toastr props to merge with the shared theme-aware defaults.
 * @returns A React element that hosts toastr notifications for the current UI tree.
 * @example
 * import { createElement } from 'react';
 * import { Toastr } from 'jg-react-ui/components/toastr';
 * const host = createElement(Toastr, { position: 'bottom-right' });
 * @throws
 * - THEME_PROVIDER_MISSING: useTheme must be used within a ThemeProvider
 */
export const Toastr = ({
  className,
  icons,
  style,
  toastOptions,
  ...props
}: IToastrProps): React.ReactElement => {
  const hasDocument = useSyncExternalStore(
    subscribeToDocument,
    getDocumentSnapshot,
    getServerSnapshot,
  );
  const { resolvedTheme } = useTheme();
  const resolvedIcons = useMemo(
    () => ({
      success: (
        <IconTile tone="success">
          <CircleCheck />
        </IconTile>
      ),
      info: (
        <IconTile>
          <Info />
        </IconTile>
      ),
      warning: (
        <IconTile tone="warning">
          <TriangleAlert />
        </IconTile>
      ),
      error: (
        <IconTile tone="destructive">
          <OctagonX />
        </IconTile>
      ),
      loading: (
        <IconTile>
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        </IconTile>
      ),
      ...icons,
    }),
    [icons],
  );
  const resolvedStyle = useMemo(
    () => ({ ...TOASTR_STYLE, ...style, zIndex: TOASTR_MAX_Z_INDEX }),
    [style],
  );
  const resolvedToastOptions = useMemo(
    () => ({
      ...toastOptions,
      style: {
        borderInlineStartColor: TOASTR_DEFAULT_ACCENT_COLORS[resolvedTheme],
        ...toastOptions?.style,
      },
      classNames: mergeToastrClassNames(toastOptions?.classNames),
    }),
    [resolvedTheme, toastOptions],
  );
  const toastr = (
    <SonnerToaster
      theme={resolvedTheme}
      className={cn('toastr group pointer-events-auto !font-sans', className)}
      icons={resolvedIcons}
      style={resolvedStyle}
      toastOptions={resolvedToastOptions}
      {...props}
    />
  );

  return !hasDocument
    ? toastr
    : createPortal(
        <div
          data-slot="toastr-portal"
          style={TOASTR_PORTAL_STYLE}
        >
          {toastr}
        </div>,
        document.body,
      );
};
