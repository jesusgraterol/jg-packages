import { cn } from 'cnfast';

import { TOASTR_CLASS_NAMES } from './constants.js';
import type { IToastrClassNames } from './types.js';

/**
 * Merges shared toastr class names with any consumer-provided overrides.
 * @param classNames Optional toastr class name overrides.
 * @returns A merged class name map that preserves the shared defaults.
 */
export const mergeToastrClassNames = (classNames?: IToastrClassNames): IToastrClassNames => ({
  ...classNames,
  toast: cn(TOASTR_CLASS_NAMES.toast, classNames?.toast),
  title: cn(TOASTR_CLASS_NAMES.title, classNames?.title),
  description: cn(TOASTR_CLASS_NAMES.description, classNames?.description),
  content: cn(TOASTR_CLASS_NAMES.content, classNames?.content),
  icon: cn(TOASTR_CLASS_NAMES.icon, classNames?.icon),
  loader: cn(TOASTR_CLASS_NAMES.loader, classNames?.loader),
  success: cn(TOASTR_CLASS_NAMES.success, classNames?.success),
  info: cn(TOASTR_CLASS_NAMES.info, classNames?.info),
  warning: cn(TOASTR_CLASS_NAMES.warning, classNames?.warning),
  error: cn(TOASTR_CLASS_NAMES.error, classNames?.error),
  loading: cn(TOASTR_CLASS_NAMES.loading, classNames?.loading),
  closeButton: cn(TOASTR_CLASS_NAMES.closeButton, classNames?.closeButton),
  actionButton: cn(TOASTR_CLASS_NAMES.actionButton, classNames?.actionButton),
  cancelButton: cn(TOASTR_CLASS_NAMES.cancelButton, classNames?.cancelButton),
});
