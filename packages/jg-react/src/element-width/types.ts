// what useElementWidth returns: the ref to attach, and what select gave for the element's width
export type IUseElementWidthResult<T> = {
  // attaches the element to measure, or detaches it with null
  ref: (element: Element | null) => void;

  // what select returned for the latest width above 0, or undefined while no element is attached
  value: T | undefined;
};
