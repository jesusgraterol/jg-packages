import type * as React from 'react';
import { Trash2Icon } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../alert-dialog/index.js';
import { IconTile } from '../icon-tile/index.js';
import {
  DEFAULT_CONFIRMATION_DIALOG_STATE,
  DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE,
} from './constants.js';
import type { IConfirmationDialogViewProps } from './types.js';

/**
 * Renders the fixed confirmation dialog surface used by the root-mounted store component.
 * @param props The open state, copy, risk styling, and completion handlers for the active session.
 * @returns A React element that renders the confirmation dialog.
 */
export const ConfirmationDialogView = ({
  getNavigationSession,
  title,
  description,
  confirmText,
  destructive = DEFAULT_CONFIRMATION_DIALOG_STATE.destructive,
  onConfirm,
  onOpenChange,
  open,
}: IConfirmationDialogViewProps): React.ReactElement => {
  const defaults = destructive
    ? DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE
    : DEFAULT_CONFIRMATION_DIALOG_STATE;
  const resolvedTitle = title ?? defaults.title;
  const resolvedDescription = description ?? defaults.description;
  const resolvedConfirmText = confirmText ?? defaults.confirmText;

  return (
    <AlertDialog
      {...(getNavigationSession === undefined ? {} : { getNavigationSession })}
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent {...(resolvedDescription ? {} : { 'aria-describedby': undefined })}>
        <AlertDialogHeader>
          {destructive ? (
            <IconTile
              size="lg"
              tone="destructive"
              className="mx-auto"
            >
              <Trash2Icon aria-hidden="true" />
            </IconTile>
          ) : null}
          <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          {resolvedDescription ? (
            <AlertDialogDescription>{resolvedDescription}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogAction
            size="touch"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {resolvedConfirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
