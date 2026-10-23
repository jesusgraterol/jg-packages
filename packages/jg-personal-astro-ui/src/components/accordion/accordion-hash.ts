// document ownership survives Astro navigation and separately bundled component scripts
const CONTROLLER = Symbol.for('jg-personal-astro-ui.accordion-hash');

/** Opens collapsed ancestors of a fragment inside an owned accordion, without moving focus. */
const revealHash = (root: Document, view: Window): void => {
  const fragment = view.location.hash.slice(1);
  if (fragment === '') return;
  let id: string;
  try {
    id = decodeURIComponent(fragment);
  } catch {
    // malformed percent encoding is an invalid fragment, not a disclosure failure
    return;
  }
  const target = root.getElementById(id);
  if (target === null || target.closest('.jg-accordion') === null) return;
  const ancestors: HTMLDetailsElement[] = [];
  for (
    let element: HTMLElement | null = target;
    element !== null;
    element = element.parentElement
  ) {
    if (element.tagName === 'DETAILS') ancestors.push(element as HTMLDetailsElement);
  }
  let didOpen = false;
  for (const details of ancestors.reverse()) {
    if (details.open) continue;
    details.open = true;
    didOpen = true;
  }
  if (didOpen) target.scrollIntoView({ block: 'start', behavior: 'instant' });
};

/**
 * Reveals accordion deep links initially, after fragment changes, and after Astro or history
 * restoration. Native details retain all keyboard and grouping behavior without JavaScript.
 * Repeated registration installs no additional listeners.
 * @param root The owning document. Defaults to the page's.
 */
export const registerAccordionHash = (root: Document = document): void => {
  const view = root.defaultView;
  if (view === null) return;
  const owner = root as Document & { [CONTROLLER]?: () => void };
  if (owner[CONTROLLER] !== undefined) {
    owner[CONTROLLER]();
    return;
  }
  const reveal = (): void => revealHash(root, view);
  owner[CONTROLLER] = reveal;
  view.addEventListener('hashchange', reveal);
  view.addEventListener('pageshow', reveal);
  root.addEventListener('astro:page-load', reveal);
  reveal();
};
