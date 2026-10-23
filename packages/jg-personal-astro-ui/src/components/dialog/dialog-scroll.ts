// one background lock is shared by the document's open dialogs
const locks = new WeakMap<Document, { count: number; restore: () => void }>();

/** Saves only the inline properties the lock owns, preserving unrelated changes. */
const saveStyles = (element: HTMLElement, names: string[]): (() => void) => {
  const hadStyle = element.hasAttribute('style');
  const properties = names.map((name) => ({
    name,
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name),
  }));
  return () => {
    for (const { name, value, priority } of properties) {
      if (value === '') element.style.removeProperty(name);
      else element.style.setProperty(name, value, priority);
    }
    if (!hadStyle && element.style.length === 0) element.removeAttribute('style');
  };
};

/**
 * Locks the background until every acquired dialog lock is released. Fixed positioning also
 * prevents touch scrolling on Safari. Release restores owned styles and the original position.
 * @param root The dialog's document.
 * @returns An idempotent release function.
 */
export const lockDialogScroll = (root: Document): (() => void) => {
  const view = root.defaultView;
  if (view === null) return () => undefined;
  let lock = locks.get(root);
  if (lock === undefined) {
    const { scrollX, scrollY } = view;
    const html = root.documentElement;
    const body = root.body;
    const restoreHtml = saveStyles(html, ['overflow', 'scroll-behavior']);
    const restoreBody = saveStyles(body, [
      'position',
      'top',
      'left',
      'width',
      'overflow',
      'padding-right',
    ]);
    const gap = Math.max(0, view.innerWidth - html.clientWidth);
    const padding = view.getComputedStyle(body).paddingRight;
    html.style.setProperty('overflow', 'hidden');
    html.style.setProperty('scroll-behavior', 'auto');
    body.style.setProperty('position', 'fixed');
    body.style.setProperty('top', `${-scrollY}px`);
    body.style.setProperty('left', `${-scrollX}px`);
    body.style.setProperty('width', '100%');
    body.style.setProperty('overflow', 'hidden');
    if (gap > 0) body.style.setProperty('padding-right', `calc(${padding} + ${gap}px)`);
    lock = {
      count: 0,
      restore: () => {
        restoreBody();
        view.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
        restoreHtml();
      },
    };
    locks.set(root, lock);
  }
  lock.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count--;
    if (lock.count === 0) {
      locks.delete(root);
      lock.restore();
    }
  };
};
