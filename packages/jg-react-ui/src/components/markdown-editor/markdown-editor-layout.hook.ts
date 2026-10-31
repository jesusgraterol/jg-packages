import { useState, useCallback, useEffect } from 'react';

import { MARKDOWN_EDITOR_LAYOUTS } from './constants.js';
import { getMarkdownEditorLayoutForWidth } from './layout.utilities.js';
import type {
  IMarkdownEditorLayout,
  IMarkdownEditorLayoutResult,
  IResolvedMarkdownEditorLayout,
} from './types.js';

/**
 * Observes the editor container and resolves the requested responsive layout.
 * @param layout The automatic policy or explicit editor layout override.
 * @returns The container callback ref and currently resolved layout.
 */
export const useMarkdownEditorLayout = (
  layout: IMarkdownEditorLayout,
): IMarkdownEditorLayoutResult => {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [responsiveLayout, setResponsiveLayout] = useState<IResolvedMarkdownEditorLayout | null>(
    null,
  );

  const containerRef = useCallback((element: HTMLDivElement | null): void => {
    setContainerElement(element);
  }, []);

  useEffect(() => {
    if (layout !== MARKDOWN_EDITOR_LAYOUTS.Auto || containerElement === null) {
      return undefined;
    }

    /**
     * Updates responsive state only when the measured width crosses the layout threshold.
     * @param width The latest available container width in CSS pixels.
     */
    const updateResponsiveLayout = (width: number): void => {
      if (width <= 0) {
        return;
      }

      const nextLayout = getMarkdownEditorLayoutForWidth(width);

      setResponsiveLayout((currentLayout) =>
        currentLayout === nextLayout ? currentLayout : nextLayout,
      );
    };

    updateResponsiveLayout(containerElement.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) updateResponsiveLayout(entry.contentRect.width);
    });

    resizeObserver.observe(containerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerElement, layout]);

  return {
    containerRef,
    resolvedLayout: layout === MARKDOWN_EDITOR_LAYOUTS.Auto ? responsiveLayout : layout,
  };
};
