import { useState, useEffect } from 'react';

/**
 * Reads whether the current document is using the dark theme class.
 * @returns True when the root document element is in dark mode.
 */
const getIsDarkMode = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/**
 * Tracks the current document theme so the editor can remount with the matching CodeMirror theme.
 * @returns True when the document is currently in dark mode.
 */
export const useIsDarkMode = (): boolean => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getIsDarkMode());

  useEffect(() => {
    const rootElement = document.documentElement;

    /**
     * Mirrors the current root theme class into local React state.
     */
    const syncIsDarkMode = (): void => {
      setIsDarkMode(rootElement.classList.contains('dark'));
    };

    syncIsDarkMode();

    const observer = new MutationObserver(() => {
      syncIsDarkMode();
    });

    observer.observe(rootElement, {
      attributeFilter: ['class'],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkMode;
};
