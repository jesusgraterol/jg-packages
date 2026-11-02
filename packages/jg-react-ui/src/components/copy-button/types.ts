import type { IButtonProps } from '../button/index.js';

/** Copy button props keep the copy action and icon content owned by the component.
 * @see CopyButton
 */
export type ICopyButtonProps = Omit<IButtonProps, 'children' | 'onClick' | 'type' | 'value'> & {
  copiedFeedbackDuration?: number;
  copiedLabel?: string;
  // ready-state name for icon-only actions; successful writes retain copied feedback.
  copyLabel?: string;
  label?: string;
  // the text, or what reads it after the click, such as a document the page loads on demand
  value: string | (() => Promise<string>);
};
