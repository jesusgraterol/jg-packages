import type * as React from 'react';

import type { IToastrClassNames } from './types.js';

// toastrs must sit above every application overlay, including stacked modal portals.
export const TOASTR_MAX_Z_INDEX = 2147483647;

// the portal layer creates a top-level stacking context without blocking the active dialog.
export const TOASTR_PORTAL_STYLE: React.CSSProperties = {
  inset: 0,
  pointerEvents: 'none',
  position: 'fixed',
  zIndex: TOASTR_MAX_Z_INDEX,
};

/*
 * Shared toastr classes keep the notification surface aligned with the package tokens in both themes.
 * Built-in icons render as IconTile: with a description the md tile spans the title and description;
 * title-only toasts flatten the tile into a bare 16px glyph on the title line. The toast is a size
 * container so the action sits beside the text at desktop widths and below it on narrow screens.
 * Spacing lives on the icon and action rather than the grid gap, so icon-less toasts stay flush.
 */
export const TOASTR_CLASS_NAMES: IToastrClassNames = {
  toast:
    'toast @container !grid grid-cols-[auto_minmax(0,1fr)_auto] gap-y-1 rounded-lg border border-border !border-s-[3px] bg-background text-foreground shadow-raised has-[[data-description]]:[&_[data-icon]]:row-span-2 not-has-[[data-description]]:[&_[data-icon]]:!mr-2 not-has-[[data-description]]:[&_[data-icon]]:self-center not-has-[[data-description]]:[&_[data-slot=icon-tile]]:!size-auto not-has-[[data-description]]:[&_[data-slot=icon-tile]]:!bg-transparent not-has-[[data-description]]:[&_[data-slot=icon-tile]_svg]:!size-4',
  title: 'col-start-2 row-start-1 min-w-0 wrap-break-word !text-sm !leading-5 !font-semibold',
  description:
    'col-start-2 row-start-2 min-w-0 wrap-break-word !text-sm !leading-5 text-secondary-foreground',
  content: '!contents',
  icon: 'col-start-1 row-start-1 !my-0 !ml-0 !mr-3 !size-auto self-start !items-start !justify-start',
  loader: 'text-secondary-foreground',
  success: '!border-s-chart-1',
  warning: '!border-s-chart-2',
  error: '!border-s-destructive',
  closeButton:
    '!size-5 pointer-coarse:!size-11 !border !border-border !bg-background !p-0 !text-secondary-foreground !shadow-none transition-colors motion-reduce:transition-none focus-visible:!ring-2 focus-visible:!ring-foreground focus-visible:outline-none enabled:hover:!bg-secondary enabled:hover:!text-foreground',
  actionButton:
    'col-start-2 justify-self-start !mx-0 !mt-1 !mb-0 !h-7 pointer-coarse:!h-11 !rounded-md !border !border-transparent !bg-primary !px-2.5 !text-xs !text-primary-foreground !shadow-none transition-colors motion-reduce:transition-none focus-visible:!ring-2 focus-visible:!ring-foreground focus-visible:outline-none enabled:hover:!bg-primary/80 @2xs:col-start-3 @2xs:row-span-2 @2xs:row-start-1 @2xs:self-center @2xs:justify-self-end @2xs:!mt-0 @2xs:!ml-3 dark:enabled:hover:!bg-primary/30',
  cancelButton:
    '!h-7 pointer-coarse:!h-11 !rounded-md !border !border-border !bg-secondary !px-2.5 !text-xs !text-foreground !shadow-none transition-colors motion-reduce:transition-none focus-visible:!ring-2 focus-visible:!ring-foreground focus-visible:outline-none enabled:hover:!bg-secondary/70',
};

// normal toastr accent colors preserve primary contrast in each supported theme.
export const TOASTR_DEFAULT_ACCENT_COLORS = {
  light: 'var(--primary)',
  dark: 'color-mix(in oklab, var(--primary-foreground), var(--primary))',
} as const;

// shared toastr CSS variables map the notification chrome to the package color and radius tokens.
export const TOASTR_STYLE = {
  '--normal-bg': 'var(--background)',
  '--normal-text': 'var(--foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',
  '--toast-close-button-start': 'unset',
  '--toast-close-button-end': '0',
  '--toast-close-button-transform': 'translate(35%, -35%)',
  '--toast-svg-margin-start': '0px',
  '--toast-svg-margin-end': '0px',
} as React.CSSProperties;
