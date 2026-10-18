import { ERRORS } from 'jg-clipboard';

// what getCopyGuidance needs besides the failure's code
export type ICopyGuidanceOptions = {
  // what the button copies, such as "code" or "npm install command"
  context: string;
  // the button's own label, which the guidance says to click again. Defaults to 'Copy'
  label?: string | null | undefined;
  // whether the text is behind a link shown under the guidance, such as a page's Markdown version,
  // rather than on the page. Defaults to false
  linked?: boolean | undefined;
};

/**
 * Says what to do after a copy failed, for the reason jg-clipboard gave, so the visitor can still get
 * the text.
 * @param code The failure's code, such as CLIPBOARD_PERMISSION_DENIED, or null when it has none.
 * @param options What the button copies, its label, and whether the text is behind a link.
 * @returns The guidance.
 */
export const getCopyGuidance = (
  code: string | null,
  { context, label, linked = false }: ICopyGuidanceOptions,
): string => {
  const button = label ?? 'Copy';
  // how to get the text without the clipboard
  const manualStep = linked
    ? 'open the link below and copy the text there'
    : `select the ${context} and copy it manually`;
  const sentence = `${manualStep.charAt(0).toUpperCase()}${manualStep.slice(1)}.`;
  switch (code) {
    case ERRORS.CLIPBOARD_PERMISSION_DENIED:
      return `Your browser blocked copying. ${sentence}`;
    case ERRORS.CLIPBOARD_NO_USER_GESTURE:
      return `Your browser only copies right after a click. Click ${button} again, or ${manualStep}.`;
    case ERRORS.CLIPBOARD_NOT_FOCUSED:
      return `Copying needs this tab to be in focus. Click the page, then click ${button} again.`;
    case ERRORS.CLIPBOARD_UNSUPPORTED:
      return `This browser can't copy from this page. ${sentence}`;
    default:
      return `Copying failed. ${sentence}`;
  }
};
