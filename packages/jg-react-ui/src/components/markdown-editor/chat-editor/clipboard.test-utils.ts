/** Creates a native paste event with consistent synthetic clipboard data in Firefox and WebKit. */
export const createChatPasteEvent = (clipboardData: DataTransfer): ClipboardEvent => {
  const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
  // Firefox substitutes an empty transfer for untrusted constructor clipboardData.
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return event;
};
