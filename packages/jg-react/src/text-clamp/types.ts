// what useIsTextClamped takes
export type IUseIsTextClampedOptions = {
  // the lines the clamp shows, a positive integer, as the element's line-clamp sets them
  lines: number;

  // the text, which can change without changing the clamped box's size, so it's measured again
  content?: string | null | undefined;
};

// what useIsTextClamped returns: the ref to attach, and whether the text runs past the clamp
export type IUseIsTextClampedResult = {
  // attaches the clamped element, or detaches it with null
  ref: (element: HTMLElement | null) => void;

  // whether the text is taller than the lines the clamp shows; false without an element
  isClamped: boolean;
};
