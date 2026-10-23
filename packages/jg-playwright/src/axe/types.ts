// the rules a scan runs: 'wcag21aa', WCAG 2.0 and 2.1 levels A and AA; 'wcag22aa', those and
// WCAG 2.2 level AA; or 'axe-default', every rule axe runs by default, best practices included
export type IAxeRuleSet = 'wcag21aa' | 'wcag22aa' | 'axe-default';

// options for expectNoAxeViolations
export type IAxeOptions = {
  // a CSS selector for the part of the page to scan, such as an open dialog; the whole page when
  // it's left out
  include?: string | undefined;

  // the rules to run; 'wcag21aa' when it's left out
  ruleSet?: IAxeRuleSet | undefined;
};
