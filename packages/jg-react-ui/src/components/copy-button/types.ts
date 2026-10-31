import type { IButtonProps } from '../button/index.js';

/** Copy button props keep the copy action and icon content owned by the component.
 * @see CopyButton
 */
export type ICopyButtonProps = Omit<IButtonProps, 'children' | 'onClick' | 'type'> & {
  copiedFeedbackDuration?: number;
  copiedLabel?: string;
  // ready-state name for icon-only actions; successful writes retain copied feedback.
  copyLabel?: string;
  label?: string;
  value: string;
};
