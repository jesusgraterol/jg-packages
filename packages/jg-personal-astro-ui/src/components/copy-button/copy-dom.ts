// document identity survives Astro's HTML/body replacement and repeated bundles
const CONTROLLER_KEY = Symbol.for('jg:ui-copy-controls');
type ICopyDocument = Document & { [CONTROLLER_KEY]?: () => void };

// matches the 1rem gutter used by the package's narrow layouts
const HINT_GUTTER = 16;

/** Keeps visible failure guidance inside the viewport without changing its document ownership. */
export const positionCopyHint = (hint: HTMLElement): void => {
  const view = hint.ownerDocument.defaultView;
  if (view === null) return;
  const width = view.visualViewport?.width ?? hint.ownerDocument.documentElement.clientWidth;
  const left = (view.visualViewport?.offsetLeft ?? 0) + HINT_GUTTER;
  const right = left + width - HINT_GUTTER * 2;
  hint.style.removeProperty('transform');
  hint.style.maxWidth = `${Math.max(0, width - HINT_GUTTER * 2)}px`;
  const bounds = hint.getBoundingClientRect();
  const offset =
    bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
  if (offset !== 0) hint.style.transform = `translateX(${offset}px)`;
};

/** Collects only a changed element and its descendants, never rescanning the document per mutation. */
const copyButtonsIn = (node: Node): HTMLElement[] => {
  if (node.nodeType !== 1) return [];
  const element = node as HTMLElement;
  return [
    ...(element.matches('[data-copy-button]') ? [element] : []),
    ...element.querySelectorAll<HTMLElement>('[data-copy-button]'),
  ];
};

/**
 * Reveals controls only when their delegated handler is installed. One observer handles future
 * Markdown/windows and Astro swaps; page dismissal releases timers through onRemove, and a
 * bfcache return resumes observation. Repeated registration reveals new controls idempotently.
 * @param root The owning document.
 * @param onClick The clipboard action owned by copy-behavior.
 * @param onRemove Releases a control's pending feedback and invalidates late completions.
 */
export const registerCopyDom = (
  root: Document,
  onClick: (event: Event) => void,
  onRemove: (button: HTMLElement) => void,
): void => {
  const document = root as ICopyDocument;
  const previous = document[CONTROLLER_KEY];
  if (previous !== undefined) {
    previous();
    return;
  }
  const view = root.defaultView;
  const reveal = (button: HTMLElement): void => {
    if (!root.contains(button)) return;
    button.inert = false;
    button.classList.remove('invisible');
  };
  const processRecords = (records: MutationRecord[]): void => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        for (const button of copyButtonsIn(node)) if (!button.isConnected) onRemove(button);
      }
      for (const node of record.addedNodes) copyButtonsIn(node).forEach(reveal);
    }
  };
  const revealAll = (): void => {
    root.querySelectorAll<HTMLElement>('[data-copy-button]').forEach(reveal);
  };
  let initialize = revealAll;
  if (view !== null) {
    const observer = new view.MutationObserver(processRecords);
    let isObserving = false;
    initialize = (): void => {
      revealAll();
      if (!isObserving) {
        observer.observe(root, { childList: true, subtree: true });
        isObserving = true;
      }
    };
    const positionVisibleHints = (): void => {
      root
        .querySelectorAll<HTMLElement>('[data-copy-hint]:not([hidden])')
        .forEach(positionCopyHint);
    };
    view.addEventListener('resize', positionVisibleHints);
    view.visualViewport?.addEventListener('resize', positionVisibleHints);
    view.visualViewport?.addEventListener('scroll', positionVisibleHints);
    view.addEventListener('pagehide', () => {
      processRecords(observer.takeRecords());
      observer.disconnect();
      isObserving = false;
      root.querySelectorAll<HTMLElement>('[data-copy-button]').forEach(onRemove);
    });
    view.addEventListener('pageshow', initialize);
  }
  document[CONTROLLER_KEY] = initialize;
  root.addEventListener('click', onClick);
  root.addEventListener('astro:page-load', initialize);
  initialize();
};
