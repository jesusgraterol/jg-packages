// what useNearViewport takes
export type IUseNearViewportOptions = {
  // the margin around the viewport, as IntersectionObserver's rootMargin takes it. Defaults to 0px
  rootMargin?: string | undefined;
};

// what useNearViewport returns: the ref to attach, and whether the element is near the viewport
export type IUseNearViewportResult = {
  // attaches the element to watch, or detaches it with null
  ref: (element: Element | null) => void;

  // whether the attached element is within the margin of the viewport; false without one
  isNear: boolean;
};
