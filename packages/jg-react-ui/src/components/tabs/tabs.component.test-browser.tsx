import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('Tabs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      root.unmount();
    });
    vi.unstubAllGlobals();
    container.remove();
  });

  test('renders the selected tab and panel with shared data slots', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <Tabs defaultValue="overview">
          <TabsList
            overflowBehavior="scroll"
            aria-label="Project sections"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="settings">Settings panel</TabsContent>
        </Tabs>,
      );
    });

    const tabs = container.querySelector('[data-slot="tabs"]');
    const activeTrigger = container.querySelector('[data-slot="tabs-trigger"][data-active]');
    const visiblePanel = container.querySelector('[data-slot="tabs-content"]:not([hidden])');

    expect(tabs?.getAttribute('data-orientation')).toBe('horizontal');
    expect(activeTrigger?.textContent).toBe('Overview');
    expect(visiblePanel?.textContent).toBe('Overview panel');
  });

  test('keeps inactive content mounted when forceMount is enabled', () => {
    act(() => {
      root.render(
        <Tabs defaultValue="overview">
          <TabsList
            overflowBehavior="truncate"
            aria-label="Project sections"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent
            forceMount
            value="settings"
          >
            Settings panel
          </TabsContent>
        </Tabs>,
      );
    });

    const panels = container.querySelectorAll('[data-slot="tabs-content"]');
    const hiddenPanel = container.querySelector('[data-slot="tabs-content"][hidden]');

    expect(panels).toHaveLength(2);
    expect(hiddenPanel?.textContent).toBe('Settings panel');
  });

  test(
    'passes trigger styling to the slotted child when asChild is enabled',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <Tabs defaultValue="overview">
            <TabsList
              overflowBehavior="scroll"
              aria-label="Project sections"
            >
              <TabsTrigger
                asChild
                value="overview"
              >
                <button type="button">Overview</button>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview panel</TabsContent>
          </Tabs>,
        );
      });

      const trigger = container.querySelector('button[data-slot="tabs-trigger"]');

      expect(trigger).not.toBeNull();
      expect(trigger?.textContent).toBe('Overview');
      expect(trigger?.getAttribute('data-active')).toBe('');
    },
  );

  test('applies interactive and disabled states to a slotted link', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <Tabs defaultValue="settings">
          <TabsList
            overflowBehavior="scroll"
            aria-label="Project sections"
          >
            <TabsTrigger
              asChild
              disabled
              value="overview"
            >
              <a href="/overview">Overview</a>
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="settings">Settings panel</TabsContent>
        </Tabs>,
      );
    });

    const trigger = container.querySelector<HTMLAnchorElement>('a[data-slot="tabs-trigger"]');

    expect(trigger?.className).toContain(
      'not-disabled:not-aria-disabled:hover:[text-shadow:0_0_0_currentColor,0.02em_0_0_currentColor,-0.02em_0_0_currentColor]',
    );
    expect(trigger?.className).toContain('aria-disabled:cursor-not-allowed');
    expect(trigger?.getAttribute('aria-disabled')).toBe('true');
  });

  test('owns explicit scroll overflow without changing keyboard tab behavior', async () => {
    await act(async () => {
      root.render(
        <Tabs defaultValue="overview">
          <TabsList
            overflowBehavior="scroll"
            aria-label="Project sections"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="settings">Settings panel</TabsContent>
        </Tabs>,
      );

      await Promise.resolve();
    });

    const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
    const triggers = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]');

    expect(list?.dataset['overflowBehavior']).toBe('scroll');
    expect(list?.className).toContain('overflow-x-auto');
    expect(list?.className).toContain('scroll-px-1');
    expect(list?.className).toContain('touch-auto');
    expect(triggers[0]?.className).toContain('shrink-0');
    expect(triggers[0]?.className).toContain('scroll-mx-1');
    expect(triggers[0]?.className).not.toContain('text-ellipsis');

    await act(async () => {
      triggers[0]?.focus();
      triggers[0]?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          code: 'ArrowRight',
          key: 'ArrowRight',
        }),
      );
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(triggers[1]);
    expect(triggers[1]?.getAttribute('data-active')).toBe('');
  });

  test.each([
    ['scroll', 279, true],
    ['scroll', -32, true],
    ['scroll', 16, false],
    ['truncate', 279, false],
  ] as const)(
    'focus in %s at %d -> reveal %s',
    { tags: ['full'] },
    async (overflowBehavior, left, shouldReveal) => {
      const onFocusCapture = vi.fn();
      await act(async () => {
        root.render(
          <Tabs
            defaultValue="overview"
            activationMode="manual"
          >
            <TabsList
              overflowBehavior={overflowBehavior}
              onFocusCapture={onFocusCapture}
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="agreement">Agreement</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview panel</TabsContent>
            <TabsContent value="agreement">Agreement panel</TabsContent>
          </Tabs>,
        );

        await Promise.resolve();
      });
      const list = container.querySelector<HTMLElement>('[role="tablist"]')!;
      const agreement = container.querySelectorAll<HTMLElement>('[role="tab"]')[1]!;
      vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 0, 296, 52));
      vi.spyOn(agreement, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 0, 95, 44));
      const scrollIntoView = vi.fn();
      Object.defineProperty(agreement, 'scrollIntoView', { value: scrollIntoView });
      await act(async () => {
        agreement.focus();
        await Promise.resolve();
      });
      expect(document.activeElement).toBe(agreement);
      expect(onFocusCapture).toHaveBeenCalledTimes(1);
      if (shouldReveal)
        expect(scrollIntoView).toHaveBeenCalledWith({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'instant',
        });
      else expect(scrollIntoView).not.toHaveBeenCalled();
      expect(agreement.getAttribute('aria-selected')).toBe('false');
    },
  );

  test(
    'reveals clipped focus after container resize without activating it or following outside focus',
    { tags: ['full'] },
    async () => {
      const resizeCallbacks = new Map<() => void, Set<Element>>();
      const observe = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: () => void) {
            const elements = new Set<Element>();
            resizeCallbacks.set(callback, elements);
            this.observe = (element: Element) => {
              observe(element);
              elements.add(element);
            };
            this.disconnect = () => resizeCallbacks.delete(callback);
          }
          observe: (element: Element) => void;
          disconnect: () => void;
        },
      );
      await act(async () => {
        root.render(
          <Tabs
            defaultValue="overview"
            activationMode="manual"
          >
            <TabsList
              overflowBehavior="scroll"
              aria-label="Project sections"
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="inspection">Inspection</TabsTrigger>
            </TabsList>
          </Tabs>,
        );

        await Promise.resolve();
      });
      const list = container.querySelector<HTMLElement>('[role="tablist"]')!;
      const inspection = container.querySelectorAll<HTMLElement>('[role="tab"]')[1]!;
      const scrollIntoView = vi.fn();
      Object.defineProperty(inspection, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      });
      act(() => inspection.focus());
      expect(document.activeElement).toBe(inspection);
      vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 150, 288, 52));
      vi.spyOn(inspection, 'getBoundingClientRect').mockReturnValue(new DOMRect(309, 154, 113, 44));
      const notifyResize = () => {
        for (const [callback, elements] of resizeCallbacks) {
          if (elements.has(list)) callback();
        }
      };
      act(() => notifyResize());
      expect(observe).toHaveBeenCalledWith(list);
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      });
      expect(document.activeElement).toBe(inspection);
      expect(inspection.getAttribute('aria-selected')).toBe('false');
      act(() => inspection.blur());
      act(() => notifyResize());
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      act(() => root.render(null));
      expect(resizeCallbacks.size).toBe(0);
    },
  );

  test.each(['object', 'callback', 'cleanup'] as const)(
    'preserves %s refs and releases them on unmount',
    { tags: ['full'] },
    (kind) => {
      const objectRef = createRef<HTMLDivElement>();
      const cleanup = vi.fn();
      const callbackRef = vi.fn(() => (kind === 'cleanup' ? cleanup : undefined));
      act(() => {
        root.render(
          <Tabs defaultValue="overview">
            <TabsList
              overflowBehavior="scroll"
              ref={kind === 'object' ? objectRef : callbackRef}
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>
          </Tabs>,
        );
      });
      const list = container.querySelector('[role="tablist"]');
      if (kind === 'object') expect(objectRef.current).toBe(list);
      else expect(callbackRef).toHaveBeenCalledWith(list);
      act(() => root.render(null));
      if (kind === 'object') expect(objectRef.current).toBeNull();
      else if (kind === 'cleanup') {
        expect(cleanup).toHaveBeenCalledOnce();
        expect(callbackRef).not.toHaveBeenCalledWith(null);
      } else expect(callbackRef).toHaveBeenLastCalledWith(null);
    },
  );

  test(
    'keeps complete long labels at natural width inside a narrow scroll strip',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <div style={{ width: 320 }}>
            <Tabs defaultValue="resolution-prompt-creation">
              <TabsList
                overflowBehavior="scroll"
                aria-label="Analytics sections"
              >
                <TabsTrigger value="resolution-prompt-creation">
                  Resolution prompt creation
                </TabsTrigger>
                <TabsTrigger value="resolution-prompt-refinement">
                  Resolution prompt refinement
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>,
        );
      });

      const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
      const triggers = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]');

      expect(list?.className).toContain('w-fit');
      expect(list?.className).toContain('max-w-full');
      expect(list?.classList.contains('w-full')).toBe(false);
      expect(triggers[0]?.textContent).toBe('Resolution prompt creation');
      expect(triggers[1]?.textContent).toBe('Resolution prompt refinement');
      expect(Array.from(triggers).every((trigger) => trigger.className.includes('shrink-0'))).toBe(
        true,
      );
      expect(Array.from(triggers).some((trigger) => trigger.className.includes('truncate'))).toBe(
        false,
      );
    },
  );

  test(
    'truncates constrained labels while preserving their complete text',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <Tabs defaultValue="account-analytics">
            <TabsList
              overflowBehavior="truncate"
              aria-label="User sections"
            >
              <TabsTrigger value="account-analytics">Account analytics</TabsTrigger>
              <TabsTrigger
                aria-label="Security settings"
                value="security"
              >
                <span>Security</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="account-analytics">Analytics panel</TabsContent>
            <TabsContent value="security">Security panel</TabsContent>
          </Tabs>,
        );
      });

      const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
      const triggers = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]');

      expect(list?.dataset['overflowBehavior']).toBe('truncate');
      expect(list?.className).toContain('overflow-hidden');
      expect(list?.className).not.toContain('overflow-x-auto');
      expect(triggers[0]?.textContent).toBe('Account analytics');
      expect(triggers[0]?.title).toBe('Account analytics');
      expect(triggers[0]?.className).toContain('min-w-0');
      expect(triggers[0]?.className).toContain('text-ellipsis');
      expect(triggers[1]?.getAttribute('aria-label')).toBe('Security settings');
    },
  );
});

test('a consumer render callback that forwards legacy null refs releases the list ref', () => {
  const reference = createRef<HTMLDivElement>();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        <Tabs defaultValue="overview">
          <TabsList
            overflowBehavior="truncate"
            ref={reference}
            render={(props) => (
              <div
                {...props}
                ref={(node) => {
                  if (typeof props.ref === 'function') void props.ref(node);
                }}
              />
            )}
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>
        </Tabs>,
      ),
    );
    expect(reference.current).not.toBeNull();
    act(() => root.unmount());
    expect(reference.current).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
