import { type ReactElement, useLayoutEffect, useRef } from 'react';
import { NavigationType, Outlet, useLocation, useNavigationType } from 'react-router';

import {
  PAGE_OUTLET_CLASS_NAME,
  PAGE_OUTLET_SCROLL_HISTORY_LIMIT,
  RESTORE_CANCELLATION_EVENTS,
} from './constants.js';
import type { IPageOutletProps } from './types.js';

// how many outlets are mounted, so nested ones share the browser setting until the last one leaves
let mountedOutletCount = 0;

// the browser's setting before the first outlet mounted, which the last one restores
let originalScrollRestoration: ScrollRestoration = 'auto';

// a window scroll position
type IScrollPosition = { left: number; top: number };

/**
 * Renders the matched child route in a frame that orients each new page: it focuses the frame,
 * without scrolling, and scrolls the window to the top. Back and Forward restore the position the
 * page had instead, retrying while its content loads and grows, until the user scrolls, touches,
 * clicks, or types. A navigation that changes only the query keeps the page and its scroll. While
 * an outlet is mounted, `history.scrollRestoration` is `manual`. Import `jg-react-router/styles.css`
 * for the frame's layout and its fade, which reduced motion turns off.
 * @param props The frame's extra classes, and the key that identifies the page.
 * @returns The frame with the child route.
 * @example
 * import { createElement } from 'react';
 * import { createBrowserRouter } from 'react-router';
 * import { PageOutlet } from 'jg-react-router';
 *
 * declare const HomePage: () => null;
 * declare const SettingsPage: () => null;
 *
 * export const router = createBrowserRouter([
 *   {
 *     path: '/',
 *     element: createElement(PageOutlet, { className: 'app-main' }),
 *     children: [
 *       { index: true, element: createElement(HomePage) },
 *       { path: 'settings', element: createElement(SettingsPage) },
 *     ],
 *   },
 * ]);
 */
export const PageOutlet = ({ className, transitionKey }: IPageOutletProps): ReactElement => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const frameKey = transitionKey ?? location.pathname;
  const frameReference = useRef<HTMLDivElement>(null);
  const previousFrameKey = useRef(frameKey);
  const scrollHistory = useRef(new Map<string, IScrollPosition>());

  useLayoutEffect(() => {
    if (mountedOutletCount === 0) {
      originalScrollRestoration = window.history.scrollRestoration;
    }
    mountedOutletCount += 1;
    window.history.scrollRestoration = 'manual';
    return () => {
      mountedOutletCount -= 1;
      if (mountedOutletCount === 0) {
        window.history.scrollRestoration = originalScrollRestoration;
      }
    };
  }, []);

  useLayoutEffect(() => {
    let pendingPosition: IScrollPosition | undefined;
    let resizeObserver: ResizeObserver | undefined;
    if (previousFrameKey.current !== frameKey) {
      previousFrameKey.current = frameKey;
      pendingPosition =
        navigationType === NavigationType.Pop ? scrollHistory.current.get(location.key) : undefined;
      frameReference.current?.focus({ preventScroll: true });
      const left = pendingPosition?.left ?? 0;
      const top = pendingPosition?.top ?? 0;
      if (window.scrollX !== left || window.scrollY !== top) {
        window.scrollTo({ left, top, behavior: 'instant' });
      }
    }

    // while a restore is pending, the scroll comes from the short page, not from the user
    const recordScrollPosition = (): void => {
      if (pendingPosition !== undefined) {
        return;
      }
      const history = scrollHistory.current;
      history.delete(location.key);
      history.set(location.key, { left: window.scrollX, top: window.scrollY });
      if (history.size > PAGE_OUTLET_SCROLL_HISTORY_LIMIT) {
        const [leastRecentKey] = history.keys();
        history.delete(leastRecentKey as string);
      }
    };

    const restorePendingPosition = (): void => {
      if (pendingPosition === undefined) {
        return;
      }
      const { left, top } = pendingPosition;
      window.scrollTo({ left, top, behavior: 'instant' });
      if (window.scrollX === left && window.scrollY === top) {
        pendingPosition = undefined;
        resizeObserver?.disconnect();
        recordScrollPosition();
      }
    };

    const cancelPendingRestore = (): void => {
      pendingPosition = undefined;
      resizeObserver?.disconnect();
      recordScrollPosition();
    };

    restorePendingPosition();
    if (pendingPosition !== undefined && frameReference.current !== null) {
      resizeObserver = new ResizeObserver(restorePendingPosition);
      resizeObserver.observe(frameReference.current);
    }
    recordScrollPosition();
    window.addEventListener('scroll', recordScrollPosition, { passive: true });
    for (const eventName of RESTORE_CANCELLATION_EVENTS) {
      window.addEventListener(eventName, cancelPendingRestore, { passive: true });
    }
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', recordScrollPosition);
      for (const eventName of RESTORE_CANCELLATION_EVENTS) {
        window.removeEventListener(eventName, cancelPendingRestore);
      }
    };
  }, [frameKey, location.key, navigationType]);

  return (
    <div
      key={frameKey}
      ref={frameReference}
      tabIndex={-1}
      className={
        className === undefined ? PAGE_OUTLET_CLASS_NAME : `${PAGE_OUTLET_CLASS_NAME} ${className}`
      }
    >
      <Outlet />
    </div>
  );
};
