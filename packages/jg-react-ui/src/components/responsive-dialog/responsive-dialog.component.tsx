import type * as React from 'react';
import { isBreakpointAtLeast, useBreakpoint } from 'jg-react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog/index.js';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '../drawer/index.js';

import type { IResponsiveDialogProps } from './types.js';

/**
 * Renders a dialog from the md breakpoint up and a bottom sheet below it, as dialogs open on
 * phones: the same title, description and body, opened and closed by the same state. The sheet
 * closes with a swipe down, and a server render and the first render in the browser show the
 * sheet. It adds no history entry; pair it with a URL-backed state, such as jg-react-router's
 * useSearchParamDialog, so Back closes it on phones.
 * @param props The open state, the title, description and body, the size, and the focus targets.
 * @returns A React element that renders the dialog or the sheet.
 * @example
 * import { createElement as h } from 'react';
 * import { ResponsiveDialog } from 'jg-react-ui/components/responsive-dialog';
 * const example = h(ResponsiveDialog, {
 *   open: true,
 *   onOpenChange: () => undefined,
 *   title: 'Details',
 *   children: 'Started an hour ago',
 * });
 */
export const ResponsiveDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'medium',
  initialFocus,
  sheetInitialFocus,
  finalFocus,
  isOverlayCloseEnabled = false,
  getNavigationSession,
}: IResponsiveDialogProps): React.ReactElement => {
  const isWide = isBreakpointAtLeast(useBreakpoint(), 'md');

  if (!isWide) {
    return (
      <Drawer
        open={open}
        side="bottom"
        onOpenChange={onOpenChange}
      >
        <DrawerContent
          finalFocus={finalFocus}
          initialFocus={sheetInitialFocus}
          size={size}
        >
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description === undefined ? null : (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <DrawerBody>{children}</DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog
      {...(getNavigationSession === undefined ? {} : { getNavigationSession })}
      isOverlayCloseEnabled={isOverlayCloseEnabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        finalFocus={finalFocus}
        initialFocus={initialFocus}
        size={size}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
