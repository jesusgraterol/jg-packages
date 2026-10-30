import { cleanup, render, screen } from '@testing-library/react';
import { page } from 'vitest/browser';
import type * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  type IDropdownMenuContentProps,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Renders an opened dropdown menu with an opened nested submenu.
 * @returns A React element that renders a submenu branch for placement assertions.
 */
const OpenDropdownMenuWithSubmenu = (): React.ReactElement => (
  <DropdownMenu open>
    <DropdownMenuTrigger>Command menu</DropdownMenuTrigger>

    <DropdownMenuContent>
      <DropdownMenuSub open>
        <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>

        <DropdownMenuSubContent>
          <DropdownMenuItem>CSV</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
);

/**
 * Renders an opened dropdown menu with a direct label outside an explicit group.
 * @returns A React element that renders the loose label pattern used by docs examples.
 */
const OpenDropdownMenuWithDirectLabel = (): React.ReactElement => (
  <DropdownMenu open>
    <DropdownMenuTrigger>Account menu</DropdownMenuTrigger>

    <DropdownMenuContent>
      <DropdownMenuLabel>Account</DropdownMenuLabel>
      <DropdownMenuItem>Settings</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

/**
 * Renders an opened dropdown menu with one selected radio option.
 * @returns A React element that exposes the selected-option indicator.
 */
const OpenDropdownMenuWithRadioGroup = (): React.ReactElement => (
  <DropdownMenu open>
    <DropdownMenuTrigger>Line wrapping</DropdownMenuTrigger>

    <DropdownMenuContent>
      <DropdownMenuRadioGroup value="scroll">
        <DropdownMenuRadioItem value="scroll">Scroll horizontally</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="wrap">Wrap lines</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

describe('DropdownMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test.each(['ArrowDown', 'ArrowUp'])(
    'opens with a cancelable %s event after Base UI prevents native scrolling',
    async (key) => {
      const changes: boolean[] = [];
      await act(async () => {
        root.render(
          <DropdownMenu onOpenChange={(open) => changes.push(open)}>
            <DropdownMenuTrigger>Message actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Resolve</DropdownMenuItem>
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>,
        );

        await Promise.resolve();
      });
      const trigger = container.querySelector<HTMLButtonElement>('button')!;
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      await act(async () => {
        trigger.focus();
        trigger.dispatchEvent(event);

        await Promise.resolve();
      });
      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
      expect(changes).toStrictEqual([true]);
    },
  );

  test('keeps a menu open when its consumer prevents Escape dismissal', async () => {
    const changes: boolean[] = [];
    await act(async () => {
      root.render(
        <DropdownMenu
          defaultOpen
          onOpenChange={(open) => changes.push(open)}
        >
          <DropdownMenuTrigger>Message actions</DropdownMenuTrigger>
          <DropdownMenuContent onEscapeKeyDown={(event) => event.preventDefault()}>
            <DropdownMenuItem>Resolve</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      await Promise.resolve();
    });
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]')!;
    await act(async () => {
      menu.focus();
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      await Promise.resolve();
    });
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    expect(changes).toStrictEqual([]);
  });

  test(
    'renders submenu content outside the root menu panel so nested menus are not clipped',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(<OpenDropdownMenuWithSubmenu />);
      });

      const rootContent = document.body.querySelector('[data-slot="dropdown-menu-content"]');
      const subContent = document.body.querySelector('[data-slot="dropdown-menu-sub-content"]');

      expect(rootContent).not.toBeNull();
      expect(subContent).not.toBeNull();
      expect(rootContent?.contains(subContent)).toBe(false);
      expect(subContent?.textContent).toContain('CSV');
    },
  );

  test('renders direct labels without requiring an explicit menu group', { tags: ['full'] }, () => {
    act(() => {
      root.render(<OpenDropdownMenuWithDirectLabel />);
    });

    const label = document.body.querySelector('[data-slot="dropdown-menu-label"]');
    const item = document.body.querySelector('[data-slot="dropdown-menu-item"]');

    expect(label?.textContent).toBe('Account');
    expect(item?.textContent).toBe('Settings');
  });

  test('renders a check for the selected radio item', { tags: ['full'] }, () => {
    act(() => {
      root.render(<OpenDropdownMenuWithRadioGroup />);
    });

    const radioItems = document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const selectedCheck = radioItems[0]?.querySelector<SVGElement>(
      '[data-slot="dropdown-menu-radio-item-check"]',
    );

    expect(radioItems[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radioItems[1]?.getAttribute('aria-checked')).toBe('false');
    expect(selectedCheck?.getAttribute('aria-hidden')).toBe('true');
    expect(radioItems[1]?.querySelector('[data-slot="dropdown-menu-radio-item-check"]')).toBeNull();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test.each(['accept', 'veto', 'keep-open', 'prevent-click'] as const)(
  'selectable menu command: %s',
  async (mode) => {
    const onSelect = vi.fn((event: Event) => {
      if (mode === 'veto') event.preventDefault();
    });
    const onClick = vi.fn((event: React.MouseEvent<HTMLElement>) => {
      if (mode === 'prevent-click') event.preventDefault();
    });
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Commands</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel inset>Workspace</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={onClick}
              onSelect={onSelect}
              closeOnClick={mode !== 'keep-open'}
            >
              Save command<DropdownMenuShortcut>Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await page.getByRole('menuitem', { name: /^Save command\s*Enter$/u }).click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledTimes(mode === 'prevent-click' ? 0 : 1);
    expect(screen.getByRole('button', { name: 'Commands' }).getAttribute('aria-expanded')).toBe(
      mode === 'accept' ? 'false' : 'true',
    );
  },
);

test('checkbox and radio command aliases preserve selection, callbacks and explicit keep-open behavior', async () => {
  const onCheckedChange = vi.fn();
  const onValueChange = vi.fn();
  const onSelect = vi.fn();
  render(
    <DropdownMenu
      defaultOpen
      loopFocus
    >
      <DropdownMenuTrigger asChild>
        <button type="button">Preferences</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        loop
        forceMount
        hideWhenDetached
        avoidCollisions={false}
      >
        <DropdownMenuCheckboxItem
          defaultChecked="indeterminate"
          closeOnClick={false}
          onCheckedChange={onCheckedChange}
          onSelect={onSelect}
        >
          Auto save
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked="indeterminate"
          closeOnClick={false}
        >
          Mixed alias
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup
          defaultValue="comfortable"
          onValueChange={onValueChange}
        >
          <DropdownMenuRadioItem
            value="comfortable"
            closeOnClick={false}
          >
            Comfortable
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="compact"
            closeOnClick={false}
            onSelect={onSelect}
          >
            Compact
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await page.getByRole('menuitemcheckbox', { name: 'Auto save' }).click();
  expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(
    screen.getByRole('menuitemcheckbox', { name: 'Auto save' }).getAttribute('aria-checked'),
  ).toBe('true');
  await page.getByRole('menuitemradio', { name: 'Compact', exact: true }).click();
  expect(onValueChange).toHaveBeenCalledExactlyOnceWith('compact');
  expect(screen.getByRole('menuitemradio', { name: 'Compact' }).getAttribute('aria-checked')).toBe(
    'true',
  );
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Preferences' }).getAttribute('aria-expanded')).toBe(
    'true',
  );
});

test.each(['pointer', 'interaction', 'focus'] as const)(
  'menu dismissal honors the %s veto and releases it when props change',
  async (kind) => {
    const veto = vi.fn((event: Event) => event.preventDefault());
    const contentProps: IDropdownMenuContentProps =
      kind === 'pointer'
        ? { onPointerDownOutside: veto }
        : kind === 'focus'
          ? { onFocusOutside: veto }
          : { onInteractOutside: veto };
    const content = (props: IDropdownMenuContentProps) => (
      <>
        <DropdownMenu
          defaultOpen
          modal={false}
        >
          <DropdownMenuTrigger>Dismiss commands</DropdownMenuTrigger>
          <DropdownMenuContent {...props}>
            <DropdownMenuItem>Save</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button">Outside commands</button>
      </>
    );
    const { rerender } = render(content(contentProps));
    const outside = screen.getByRole('button', { name: 'Outside commands' });
    await act(async () => {
      if (kind === 'focus')
        screen
          .getByRole('button', { name: 'Dismiss commands' })
          .dispatchEvent(
            new FocusEvent('focusout', { bubbles: true, cancelable: true, relatedTarget: outside }),
          );
      else
        outside.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
          }),
        );
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(veto).toHaveBeenCalledOnce());
    expect(
      screen.getByRole('button', { name: 'Dismiss commands' }).getAttribute('aria-expanded'),
    ).toBe('true');
    rerender(content({}));
    await act(async () => {
      outside.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
      );
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Dismiss commands' }).getAttribute('aria-expanded'),
      ).toBe('false'),
    );
  },
);

test('nested menu selection retains submenu callbacks, slotted commands and portal separation', async () => {
  const onOpenChange = vi.fn();
  const onSelect = vi.fn();
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <a href="#commands">Export commands</a>
      </DropdownMenuTrigger>
      <DropdownMenuContent asChild>
        <div>
          <DropdownMenuSub onOpenChange={onOpenChange}>
            <DropdownMenuSubTrigger
              asChild
              textValue="Export"
            >
              <button type="button">Export</button>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                asChild
                onSelect={onSelect}
              >
                <button type="button">Export CSV</button>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await page.getByRole('menuitem', { name: 'Export', exact: true }).click();
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
  await page.getByRole('menuitem', { name: 'Export CSV', exact: true }).click();
  expect(onSelect).toHaveBeenCalledOnce();
});

test.each(['Enter', ' '] as const)(
  'keyboard %s selects despite Base UI native prevention and still honors consumer vetoes',
  async (key) => {
    const onSelect = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent<HTMLElement>) => event.preventDefault());
    const { rerender } = render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Keyboard commands</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Run command</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await act(async () => {
      const item = screen.getByRole('menuitem', { name: 'Run command' });
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Keyboard commands' }).getAttribute('aria-expanded'),
    ).toBe('false');
    rerender(
      <DropdownMenu open>
        <DropdownMenuTrigger>Keyboard commands</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={onClick}
            onSelect={onSelect}
          >
            Run command
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await act(async () => {
      const item = screen.getByRole('menuitem', { name: 'Run command' });
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
  },
);

test('slotted choice commands retain their children, click handlers, selected indicators and keep-open behavior', async () => {
  const onClick = vi.fn();
  const onSelect = vi.fn();
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>Slotted preferences</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          asChild
          onClick={onClick}
          onSelect={onSelect}
          closeOnClick={false}
        >
          <button type="button">Slotted auto save</button>
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup defaultValue="normal">
          <DropdownMenuRadioItem
            asChild
            value="compact"
            onClick={onClick}
            onSelect={onSelect}
            closeOnClick={false}
          >
            <button type="button">Slotted compact</button>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await page.getByRole('menuitemcheckbox', { name: 'Slotted auto save' }).click();
  expect(
    screen
      .getByRole('menuitemcheckbox', { name: 'Slotted auto save' })
      .getAttribute('aria-checked'),
  ).toBe('true');
  await page.getByRole('menuitemradio', { name: 'Slotted compact' }).click();
  expect(
    screen.getByRole('menuitemradio', { name: 'Slotted compact' }).getAttribute('aria-checked'),
  ).toBe('true');
  expect(onClick).toHaveBeenCalledTimes(2);
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test.each(['mouse', 'keyboard', 'base-ui'] as const)(
  'a %s click veto keeps commands open without an onSelect callback',
  async (activation) => {
    const fixture = (shouldVeto: boolean) => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Native commands</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={(event) => {
              if (shouldVeto) {
                if (activation === 'base-ui') event.preventBaseUIHandler();
                else event.preventDefault();
              }
            }}
          >
            Native command
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const { rerender } = render(fixture(true));
    const activate = async () => {
      if (activation === 'keyboard')
        await act(async () => {
          const item = screen.getByRole('menuitem', { name: 'Native command' });
          item.focus();
          item.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
          );
          await Promise.resolve();
        });
      else await page.getByRole('menuitem', { name: 'Native command', exact: true }).click();
    };
    await activate();
    expect(
      screen.getByRole('button', { name: 'Native commands' }).getAttribute('aria-expanded'),
    ).toBe('true');
    rerender(fixture(false));
    await activate();
    expect(
      screen.getByRole('button', { name: 'Native commands' }).getAttribute('aria-expanded'),
    ).toBe('false');
  },
);
