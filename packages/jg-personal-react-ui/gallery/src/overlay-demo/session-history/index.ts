// fixed session records exercise long scrollable regions in both examples.
export const SESSION_HISTORY = Array.from({ length: 32 }, (_, index) => ({
  id: `session-${index}`,
  text: `Session ${index + 1}: reviewed workspace changes and retained the previous settings.`,
}));
