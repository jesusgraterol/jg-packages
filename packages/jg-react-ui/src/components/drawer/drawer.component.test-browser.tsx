import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PanelRightClose } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../dialog/index.js';
import { Button } from '../button/index.js';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type IForceMountedRightDrawerProps = {
  open: boolean;
};

/** Renders a controlled force-mounted drawer for scroll-lock lifecycle coverage. */
const ForceMountedRightDrawer = ({ open }: IForceMountedRightDrawerProps): ReactElement => (
  <Drawer
    open={open}
    side="right"
  >
    <DrawerContent
      forceMount
      size="medium"
    >
      <DrawerHeader>
        <DrawerTitle>Navigation</DrawerTitle>
      </DrawerHeader>
      <DrawerBody>Drawer links</DrawerBody>
    </DrawerContent>
  </Drawer>
);

/** Renders the Admin navigation-to-preferences modal handoff. */
const DrawerDialogHandoff = (): ReactElement => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  return (
    <>
      <Drawer
        open={isDrawerOpen}
        side="right"
        onOpenChange={setIsDrawerOpen}
      >
        <DrawerContent size="medium">
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(false);
                setIsDialogOpen(true);
              }}
            >
              Open preferences
            </button>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Dialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      >
        <DialogContent size="medium">
          <DialogHeader>
            <DialogTitle>Preferences</DialogTitle>
          </DialogHeader>
          <DialogBody>Preference fields</DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

describe('Drawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  let getAnimationsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    // Base UI releases its shared document lock in a native task after unmount.
    await vi.waitFor(() => {
      expect(document.documentElement.style.overflowY).not.toBe('hidden');
      expect(document.body.style.overflowY).not.toBe('hidden');
      expect(document.documentElement.hasAttribute('data-base-ui-scroll-locked')).toBe(false);
    });
    container.remove();
    document.documentElement.classList.remove('app-ui-right-drawer-scroll-lock');
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    if (getAnimationsDescriptor === undefined)
      Reflect.deleteProperty(Element.prototype, 'getAnimations');
    else Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
    vi.restoreAllMocks();
  });

  test.each([false, true])(
    'uncontrolled triggers (asChild=%s) and slotted closes preserve callbacks',
    async (isSlotted) => {
      const change = vi.fn<(open: boolean) => void>();
      const complete = vi.fn<(open: boolean) => void>();
      await act(async () => {
        await Promise.resolve();
        return root.render(
          <Drawer
            side="left"
            modal={false}
            onOpenChange={change}
            onOpenChangeComplete={complete}
          >
            <DrawerTrigger asChild={isSlotted}>
              {isSlotted ? <Button>Open archive</Button> : 'Open archive'}
            </DrawerTrigger>
            <DrawerContent
              size="small"
              density="compact"
            >
              <DrawerHeader>
                <DrawerTitle>Archive</DrawerTitle>
                <DrawerDescription>Recent archived workspaces</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <DrawerClose asChild>
                  <Button>Close archive</Button>
                </DrawerClose>
              </DrawerBody>
            </DrawerContent>
          </Drawer>,
        );
      });
      const trigger = container.querySelector<HTMLButtonElement>('[data-slot="drawer-trigger"]');
      expect(trigger?.getAttribute('role')).toBeNull();
      await act(async () => {
        await Promise.resolve();
        return trigger?.click();
      });
      expect(change).toHaveBeenCalledExactlyOnceWith(true);
      await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(true));
      expect(document.body.querySelector('[data-slot="drawer-description"]')?.textContent).toBe(
        'Recent archived workspaces',
      );
      await act(async () => {
        await Promise.resolve();
        return document.body
          .querySelector<HTMLButtonElement>('[data-slot="drawer-body"] button')
          ?.click();
      });
      expect(change).toHaveBeenLastCalledWith(false);
      await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(false));
    },
  );

  test('busy drawers reject Escape through the root dismissal callback', async () => {
    const change = vi.fn<(open: boolean) => void>();
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <Drawer
          side="right"
          defaultOpen
          isDismissalDisabled
          onOpenChange={change}
        >
          <DrawerContent size="medium">
            <DrawerHeader>
              <DrawerTitle>Pending navigation</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Saving changes</DrawerBody>
          </DrawerContent>
        </Drawer>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      return document.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      );
    });
    expect(change).not.toHaveBeenCalled();
  });

  test('renders centralized left-side geometry with fixed and scrolling regions', () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <Drawer
          open
          side="left"
          onOpenChange={handleOpenChange}
        >
          <DrawerContent
            closeButtonIcon={<PanelRightClose />}
            size="small"
          >
            <DrawerHeader>
              <DrawerTitle>Navigation</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Drawer links</DrawerBody>
            <DrawerFooter>Account actions</DrawerFooter>
          </DrawerContent>
        </Drawer>,
      );
    });

    const drawerContent = document.body.querySelector<HTMLElement>('[data-slot="drawer-content"]');
    const drawerHeader = document.body.querySelector<HTMLElement>('[data-slot="drawer-header"]');
    const drawerBody = document.body.querySelector<HTMLElement>('[data-slot="drawer-body"]');
    const drawerFooter = document.body.querySelector<HTMLElement>('[data-slot="drawer-footer"]');
    const drawerOverlay = document.body.querySelector<HTMLElement>('[data-slot="drawer-overlay"]');
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close drawer"]',
    );

    expect(drawerContent?.dataset['side']).toBe('left');
    expect(drawerContent?.dataset['density']).toBe('comfortable');
    expect(drawerContent?.className).toContain('max-w-64');
    expect(drawerContent?.className).toContain('data-starting-style:[transform:translateX(-100%)]');
    expect(drawerContent?.className).toContain('motion-reduce:transition-none');
    expect(drawerBody?.className).toContain('overflow-y-auto');
    expect(drawerBody?.className).toContain('pt-4');
    expect(drawerHeader?.className).toContain('border-b');
    expect(drawerFooter?.className).toContain('border-t');
    expect(drawerFooter?.parentElement).toBe(drawerBody?.parentElement);
    expect(closeButton?.className).toContain('size-11');
    expect(closeButton?.className).toContain('sm:pointer-fine:size-8');
    expect(closeButton?.className).not.toContain('-translate-y-1/2');
    expect(closeButton?.className).toContain(
      'not-disabled:not-aria-disabled:active:not-aria-[haspopup]:translate-y-0',
    );
    expect(closeButton?.className).toContain('top-[max(1rem,env(safe-area-inset-top))]');
    expect(closeButton?.querySelector('.lucide-panel-right-close')).not.toBeNull();
    const closeVisual = closeButton?.querySelector<HTMLElement>(
      '[data-slot="drawer-close-visual"]',
    );

    expect(closeVisual?.className).toContain('size-full');
    expect(closeVisual?.className).toContain('group-active/button:translate-y-px');
    expect(closeVisual?.className).toContain('motion-reduce:group-active/button:translate-y-0');
    expect(closeVisual?.className).toContain('[&_svg]:size-4!');
    expect(drawerOverlay?.className).toContain('transition-opacity');
    expect(drawerOverlay?.className).toContain('data-ending-style:opacity-0');
    expect(drawerOverlay?.className).toContain('motion-reduce:transition-none');
    expect(drawerOverlay?.className).not.toContain('data-closed:animate-out');

    act(() => closeButton?.click());

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  test('coordinates compact spacing across the fixed header and scrolling body', () => {
    act(() => {
      root.render(
        <Drawer
          open
          side="right"
        >
          <DrawerContent
            density="compact"
            size="small"
          >
            <DrawerHeader>
              <DrawerTitle>Documentation</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Drawer links</DrawerBody>
          </DrawerContent>
        </Drawer>,
      );
    });

    const drawerContent = document.body.querySelector<HTMLElement>('[data-slot="drawer-content"]');
    const drawerHeader = document.body.querySelector<HTMLElement>('[data-slot="drawer-header"]');
    const drawerBody = document.body.querySelector<HTMLElement>('[data-slot="drawer-body"]');

    expect(drawerContent?.dataset['density']).toBe('compact');
    expect(drawerContent?.dataset['side']).toBe('right');
    expect(drawerHeader?.className).toContain('pb-2');
    expect(drawerHeader?.className).not.toContain('border-b');
    expect(drawerHeader?.className).not.toContain('min-h-16');
    expect(drawerBody?.className).toContain('pt-2');
    expect(drawerBody?.className).not.toContain('pt-4');
    expect(drawerContent?.querySelector('[data-slot="drawer-close-visual"]')?.className).toContain(
      'size-full',
    );
  });

  test('releases the desktop gutter adjustment when force-mounted content finishes closing', async () => {
    let completeAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      completeAnimation = resolve;
    });

    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [{ finished: animationFinished }],
    });
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);

    await act(async () => {
      root.render(<ForceMountedRightDrawer open />);
      document.documentElement.style.scrollbarGutter = 'stable';
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock'),
    );

    act(() => {
      root.render(<ForceMountedRightDrawer open={false} />);
    });

    expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock');

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      completeAnimation?.();
      await animationFinished;
    });

    expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    expect(document.documentElement.classList).not.toContain('app-ui-right-drawer-scroll-lock');
  });

  test('reveals the remaining Base UI lock after handing off to a dialog', async () => {
    let completeAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      completeAnimation = resolve;
    });

    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [{ finished: animationFinished }],
    });
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);

    act(() => {
      root.render(<DrawerDialogHandoff />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock'),
    );

    act(() => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Open preferences')
        ?.click();
    });

    expect(document.body.querySelector('[data-slot="dialog-content"][data-open]')).not.toBeNull();
    expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock');

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      completeAnimation?.();
      await animationFinished;
    });

    expect(document.body.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(document.body.querySelector('[data-slot="dialog-content"][data-open]')).not.toBeNull();
    await vi.waitFor(() =>
      expect(document.documentElement.classList).not.toContain('app-ui-right-drawer-scroll-lock'),
    );
    expect(document.documentElement.style.scrollbarGutter).toContain('stable');
  });

  test('disables every dismissal control while the drawer is busy', () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <Drawer
          isDismissalDisabled
          open
          side="right"
          onOpenChange={handleOpenChange}
        >
          <DrawerContent size="medium">
            <DrawerHeader actions={<DrawerClose disabled={false}>Close explicitly</DrawerClose>}>
              <DrawerTitle>Pending navigation</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Pending work</DrawerBody>
          </DrawerContent>
        </Drawer>,
      );
    });

    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close drawer"]',
    );
    const explicitCloseButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[data-slot="drawer-close"]'),
    ).find((button) => button.textContent === 'Close explicitly');

    expect(closeButton?.disabled).toBe(true);
    expect(explicitCloseButton?.disabled).toBe(true);

    act(() => closeButton?.click());

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  test('rejects drawers without the mandatory fixed header and scrolling body', () => {
    expect(() => {
      act(() => {
        root.render(
          <Drawer
            open
            side="right"
          >
            <DrawerContent size="small">
              <DrawerHeader>
                <DrawerTitle>Navigation</DrawerTitle>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>,
        );
      });
    }).toThrowError(
      'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
    );
  });

  test('rejects a footer placed before the scrolling body', () => {
    expect(() => {
      act(() => {
        root.render(
          <Drawer
            open
            side="right"
          >
            <DrawerContent size="small">
              <DrawerHeader>
                <DrawerTitle>Navigation</DrawerTitle>
              </DrawerHeader>
              <DrawerFooter>Account actions</DrawerFooter>
              <DrawerBody>Drawer links</DrawerBody>
            </DrawerContent>
          </Drawer>,
        );
      });
    }).toThrowError(
      'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
    );
  });
});
