// options for expectNoAxeViolations
export type IAxeOptions = {
  // a CSS selector for the part of the page to scan, such as an open dialog; the whole page when
  // it's left out
  include?: string | undefined;
};
