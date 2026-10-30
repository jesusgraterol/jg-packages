// document-scoped state preserves nested drawer ownership and pre-existing CSS hooks.
type IActiveDocumentScrollbarGutter = {
  count: number;
  document: Document;
  hadAdjustmentClass: boolean;
  isApplied: boolean;
  observer: MutationObserver | null;
  originalScrollbarWidthPriority: string;
  originalScrollbarWidthValue: string;
  scrollbarWidth: number;
};

// active document adjustments are reference-counted for nested right-side drawers.
const activeDocumentScrollbarGutters = new Map<Document, IActiveDocumentScrollbarGutter>();

// the stylesheet owns gutter geometry while Base UI continues to own modal scroll-lock styles.
const RIGHT_DRAWER_SCROLL_LOCK_CLASS_NAME = 'app-ui-right-drawer-scroll-lock';
const RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY = '--app-ui-right-drawer-scrollbar-width';

/**
 * Removes a modal scroll lock's reserved desktop scrollbar gutter without moving the page or
 * placing the drawer beneath the browser-owned gutter surface.
 * @param viewportElement The right-side drawer viewport used to resolve the owning document.
 * @returns A function that restores the document after the drawer closes.
 */
export const preserveDocumentWidthWithoutScrollbarGutter = (
  viewportElement: HTMLDivElement,
): (() => void) => {
  const ownerDocument = viewportElement.ownerDocument;
  const activeAdjustment = activeDocumentScrollbarGutters.get(ownerDocument);

  if (activeAdjustment !== undefined) {
    activeAdjustment.count += 1;

    return () => {
      releaseDocumentScrollbarGutter(activeAdjustment);
    };
  }

  const ownerWindow = ownerDocument.defaultView;
  const documentWidth = ownerDocument.documentElement.clientWidth;
  const scrollbarWidth =
    ownerWindow === null || documentWidth === 0
      ? 0
      : Math.max(0, ownerWindow.innerWidth - documentWidth);

  if (ownerWindow === null || scrollbarWidth === 0) {
    return () => undefined;
  }

  const adjustment: IActiveDocumentScrollbarGutter = {
    count: 1,
    document: ownerDocument,
    hadAdjustmentClass: ownerDocument.documentElement.classList.contains(
      RIGHT_DRAWER_SCROLL_LOCK_CLASS_NAME,
    ),
    isApplied: false,
    observer: null,
    originalScrollbarWidthPriority: ownerDocument.documentElement.style.getPropertyPriority(
      RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY,
    ),
    originalScrollbarWidthValue: ownerDocument.documentElement.style.getPropertyValue(
      RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY,
    ),
    scrollbarWidth,
  };

  activeDocumentScrollbarGutters.set(ownerDocument, adjustment);
  adjustment.observer = new ownerWindow.MutationObserver(() => {
    applyDocumentScrollbarGutterAdjustment(adjustment);
  });
  adjustment.observer.observe(ownerDocument.documentElement, {
    attributeFilter: ['data-base-ui-scroll-locked', 'style'],
    attributes: true,
  });
  applyDocumentScrollbarGutterAdjustment(adjustment);

  return () => {
    releaseDocumentScrollbarGutter(adjustment);
  };
};

/**
 * Applies the gutter removal after Base UI establishes its modal scroll lock.
 * @param adjustment The active document adjustment.
 */
const applyDocumentScrollbarGutterAdjustment = (
  adjustment: IActiveDocumentScrollbarGutter,
): void => {
  if (activeDocumentScrollbarGutters.get(adjustment.document) !== adjustment) {
    return;
  }

  const { documentElement } = adjustment.document;
  const isBaseUiScrollLockActive =
    documentElement.style.scrollbarGutter.includes('stable') ||
    documentElement.hasAttribute('data-base-ui-scroll-locked');

  if (!isBaseUiScrollLockActive && !adjustment.isApplied) {
    return;
  }

  const scrollbarWidthValue = `${adjustment.scrollbarWidth}px`;

  if (
    documentElement.style.getPropertyValue(RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY) !==
    scrollbarWidthValue
  ) {
    // WebKit needs the retained priority to replace an important inline custom property.
    documentElement.style.setProperty(
      RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY,
      scrollbarWidthValue,
      adjustment.originalScrollbarWidthPriority,
    );
  }

  if (!documentElement.classList.contains(RIGHT_DRAWER_SCROLL_LOCK_CLASS_NAME)) {
    documentElement.classList.add(RIGHT_DRAWER_SCROLL_LOCK_CLASS_NAME);
  }

  adjustment.isApplied = true;
};

/**
 * Releases one drawer and restores the document when the final drawer closes.
 * @param adjustment The active document adjustment.
 */
const releaseDocumentScrollbarGutter = (adjustment: IActiveDocumentScrollbarGutter): void => {
  adjustment.count -= 1;

  if (adjustment.count > 0) {
    return;
  }

  adjustment.observer?.disconnect();

  if (adjustment.isApplied) {
    const { documentElement } = adjustment.document;

    if (!adjustment.hadAdjustmentClass) {
      documentElement.classList.remove(RIGHT_DRAWER_SCROLL_LOCK_CLASS_NAME);
    }

    if (adjustment.originalScrollbarWidthValue === '') {
      documentElement.style.removeProperty(RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY);
    } else {
      documentElement.style.setProperty(
        RIGHT_DRAWER_SCROLLBAR_WIDTH_PROPERTY,
        adjustment.originalScrollbarWidthValue,
        adjustment.originalScrollbarWidthPriority,
      );
    }
  }

  activeDocumentScrollbarGutters.delete(adjustment.document);
};
