# jg-react recipes

Patterns for components that follow the browser: the network, the tab, the viewport, and the scroll position.

## An offline banner

Tell people why a request failed, instead of letting the page look broken:

```tsx
import { useOnlineStatus } from 'jg-react';

export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) {
    return null;
  }
  return (
    <div
      role="status"
      className="bg-warning px-4 py-2 text-sm"
    >
      You're offline. Your changes will sync when you reconnect.
    </div>
  );
};
```

The browser's guess can be wrong both ways: a connected laptop can lack internet access, and a flaky network can report online. Use it to explain a failure, never to skip a request.

## Polling only while the tab is visible

Stop refreshing data nobody is looking at, and refresh once when the tab comes back:

```tsx
import { useEffect, useState } from 'react';
import { useDocumentVisibility } from 'jg-react';

declare const fetchPrice: (symbol: string) => Promise<number>;

export const LivePrice = ({ symbol }: { symbol: string }) => {
  const isVisible = useDocumentVisibility();
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }
    const refresh = (): void => {
      void fetchPrice(symbol).then(setPrice);
    };
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [isVisible, symbol]);

  return <span>{price ?? '…'}</span>;
};
```

## A navigation that changes with the viewport

Render a different component on a phone, where CSS alone can't swap them, and shadow the header once the page scrolls:

```tsx
import type { JSX } from 'react';
import { isBreakpointAtLeast, useBreakpoint, useIsWindowScrolledPast } from 'jg-react';

declare const SideNavigation: () => JSX.Element;
declare const BottomTabs: () => JSX.Element;

export const AppHeader = () => {
  const breakpoint = useBreakpoint();
  const isScrolled = useIsWindowScrolledPast(8);

  return (
    <header className={isScrolled ? 'sticky top-0 shadow-md' : 'sticky top-0'}>
      {isBreakpointAtLeast(breakpoint, 'md') ? <SideNavigation /> : <BottomTabs />}
    </header>
  );
};
```

`useBreakpoint` is `undefined` in a server render, so `isBreakpointAtLeast` is false there, and the page renders the phone layout first, then the wider one once it hydrates.
