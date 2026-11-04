import { useCallback, useEffect, useRef, useState } from 'react';

import type { IUseNewBuildAvailableOptions, IUseNewBuildAvailableResult } from './types.js';
import { isNewerBuild, readEntryScript } from './utilities.js';

/**
 * Tells when the server serves a newer build of the app than the open page, so an old tab can
 * offer a reload instead of missing what a deploy changed. It compares the entry script the
 * entry page loads now with the open page's, each time the page becomes visible again and when
 * `check` asks, and treats a lazy chunk the open build named that's gone, which Vite reports with
 * `vite:preloadError`, as a new build, unless the browser is offline. It prevents that event's
 * default, so the import resolves with no module instead of rejecting, which route loaders such
 * as jg-react-router's loadRouteModule treat as code that couldn't load. A read that fails, is
 * redirected or isn't HTML says nothing. The page never reloads on its own.
 * @param options The entry page and the folder of the build's hashed scripts.
 * @returns Whether a newer build is available, and what checks again.
 * @example
 * import { useNewBuildAvailable } from 'jg-react';
 *
 * export const useUpdateBanner = () => useNewBuildAvailable().isNewBuildAvailable;
 */
export const useNewBuildAvailable = ({
  entryPath = '/',
  assetPrefix = '/assets/',
}: IUseNewBuildAvailableOptions = {}): IUseNewBuildAvailableResult => {
  const [isNewBuildAvailable, setIsNewBuildAvailable] = useState(false);
  // set at once, so checks that overlap stop as soon as one finds the new build
  const isFoundRef = useRef(false);

  const markAvailable = useCallback((): void => {
    isFoundRef.current = true;
    setIsNewBuildAvailable(true);
  }, []);

  const check = useCallback(async (): Promise<void> => {
    if (isFoundRef.current) {
      return;
    }
    const current = readEntryScript(document, assetPrefix);
    if (current === null) {
      return;
    }
    try {
      const response = await fetch(entryPath, { cache: 'no-store', redirect: 'manual' });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
        return;
      }
      if (isNewerBuild(current, await response.text(), assetPrefix)) {
        markAvailable();
      }
    } catch {
      // a read that fails, such as while the server restarts, leaves the next check to tell
    }
  }, [assetPrefix, entryPath, markAvailable]);

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    };
    // a lazy chunk an older build named is gone after a deploy, which only a reload can load
    const handlePreloadError = (event: Event): void => {
      if (!navigator.onLine) {
        return;
      }
      event.preventDefault();
      markAvailable();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vite:preloadError', handlePreloadError);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vite:preloadError', handlePreloadError);
    };
  }, [check, markAvailable]);

  return { isNewBuildAvailable, check };
};
