/**
 * Reads an element's border-box width from a ResizeObserver entry, or, from a browser that
 * reports no border box, measures the element instead.
 * @param entry The observer's entry for the element.
 * @param element The element.
 * @returns The width, in pixels.
 */
export const readBorderBoxWidth = (
  entry: ResizeObserverEntry | undefined,
  element: Element,
): number => entry?.borderBoxSize[0]?.inlineSize ?? element.getBoundingClientRect().width;
