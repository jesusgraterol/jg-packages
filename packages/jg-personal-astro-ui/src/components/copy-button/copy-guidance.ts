import { ERRORS } from 'jg-clipboard';

/**
 * Says what to do after a copy failed, for the reason jg-clipboard gave, so the visitor can still get
 * the text.
 * @param code The failure's code, such as CLIPBOARD_PERMISSION_DENIED, or null when it has none.
 * @param context What the button copies, such as "code" or "npm install command".
 * @returns The guidance.
 */
export const getCopyGuidance = (code: string | null, context: string): string => {
  switch (code) {
    case ERRORS.CLIPBOARD_PERMISSION_DENIED:
      return `Your browser blocked copying. Select the ${context} and copy it manually.`;
    case ERRORS.CLIPBOARD_NO_USER_GESTURE:
      return `Your browser only copies right after a click. Click Copy again, or select the ${context} and copy it manually.`;
    case ERRORS.CLIPBOARD_NOT_FOCUSED:
      return 'Copying needs this tab to be in focus. Click the page, then click Copy again.';
    case ERRORS.CLIPBOARD_UNSUPPORTED:
      return `This browser can't copy from this page. Select the ${context} and copy it manually.`;
    default:
      return `Copying failed. Select the ${context} and copy it manually.`;
  }
};
