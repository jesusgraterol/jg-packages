import { act, useRef, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ResponsiveDialog } from './responsive-dialog.component.js';
import type { IResponsiveDialogProps } from './types.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type IDetailsProps = Partial<
  Pick<IResponsiveDialogProps, 'getNavigationSession' | 'initialFocus' | 'isOverlayCloseEnabled'>
> & {
  onOpenChange?: (open: boolean) => void;
  isSearchFocusedOnPhones?: boolean;
};

/** Renders a button that opens a details dialog with a search field. */
const Details = ({
  onOpenChange,
  isSearchFocusedOnPhones = false,
  ...props
}: IDetailsProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Open details
      </button>
      <ResponsiveDialog
        {...props}
        description="Where the session runs"
        open={isOpen}
        sheetInitialFocus={isSearchFocusedOnPhones ? searchRef : false}
        title="Session details"
        onOpenChange={(open) => {
          onOpenChange?.(open);
          setIsOpen(open);
        }}
      >
        <label>
          Search
          <input
            ref={searchRef}
            type="search"
          />
        </label>
      </ResponsiveDialog>
    </>
  );
};

describe('ResponsiveDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
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
      expect(document.documentElement.hasAttribute('data-base-ui-scroll-locked')).toBe(false);
    });
    container.remove();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    await page.viewport(414, 896);
  });

  /**
   * Renders the details and opens them with their button.
   * @param props The dialog's options.
   * @returns The button that opened them.
   */
  const openDetails = async (props: IDetailsProps = {}) => {
    await act(async () => {
      await Promise.resolve();
      return root.render(<Details {...props} />);
    });
    const opener = container.querySelector('button') as HTMLButtonElement;
    // a pointer press focuses the button before its click
    opener.focus();
    await act(async () => {
      await Promise.resolve();
      return opener.click();
    });
    return opener;
  };

  test('opens as a bottom sheet below the md breakpoint, named by its title', async () => {
    await page.viewport(375, 812);
    await openDetails();

    const sheet = await vi.waitFor(() => {
      const content = document.body.querySelector<HTMLElement>('[data-slot="drawer-content"]');
      expect(content?.dataset['side']).toBe('bottom');
      return content as HTMLElement;
    });
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(sheet.getAttribute('role')).toBe('dialog');
    const titleId = sheet.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(titleId)?.textContent).toBe('Session details');
    expect(document.body.querySelector('[data-slot="drawer-description"]')?.textContent).toBe(
      'Where the session runs',
    );
  });

  test('keeps the keyboard closed on phones unless the sheet asks for its field', async () => {
    await page.viewport(375, 812);
    await openDetails();
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    });
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    root = createRoot(container);

    await openDetails({ isSearchFocusedOnPhones: true });

    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute('type')).toBe('search');
    });
  });

  test('opens as a dialog from the md breakpoint, with its own focus target', async () => {
    await page.viewport(1024, 768);
    await openDetails({ initialFocus: 'dismiss-control' });

    const dialog = await vi.waitFor(() => {
      const content = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
      expect(content).not.toBeNull();
      return content as HTMLElement;
    });
    expect(document.body.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(dialog.className).toContain('max-w-');
    expect(document.body.querySelector('[data-slot="dialog-description"]')?.textContent).toBe(
      'Where the session runs',
    );
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute('aria-label')).toMatch(/close/i);
    });
  });

  test.each([
    ['a phone', 375, 812],
    ['a laptop', 1024, 768],
  ])('closes on Escape on %s and returns focus to its opener', async (_name, width, height) => {
    await page.viewport(width, height);
    const handleOpenChange = vi.fn<(open: boolean) => void>();
    const opener = await openDetails({
      onOpenChange: handleOpenChange,
      getNavigationSession: () => null,
    });
    await vi.waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    await act(async () => {
      await Promise.resolve();
      return document.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      );
    });

    expect(handleOpenChange).toHaveBeenLastCalledWith(false);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  test.each([
    ['a phone', 375, 812, 'drawer'],
    ['a laptop', 1024, 768, 'dialog'],
  ])('renders no description on %s when it has none', async (_name, width, height, slot) => {
    await page.viewport(width, height);
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <ResponsiveDialog
          open
          size="small"
          title="Model"
          onOpenChange={() => undefined}
        >
          One line
        </ResponsiveDialog>,
      );
    });

    await vi.waitFor(() => {
      expect(document.body.querySelector(`[data-slot="${slot}-content"]`)).not.toBeNull();
    });
    expect(document.body.querySelector(`[data-slot="${slot}-description"]`)).toBeNull();
  });

  test('turns from a sheet into a dialog when the screen widens while it is open', async () => {
    await page.viewport(375, 812);
    await openDetails();
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull();
    });

    await page.viewport(1024, 768);

    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
      expect(document.body.querySelector('[data-slot="drawer-content"]')).toBeNull();
    });
  });
});
