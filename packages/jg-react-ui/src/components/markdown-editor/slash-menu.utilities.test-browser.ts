import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  getClampedMarkdownEditorSlashMenuPosition,
  mountMarkdownEditorSlashMenuPortal,
} from './slash-menu.utilities.js';

type ISlashMenuFixture = {
  editorContainer: HTMLDivElement;
  editorWrapper: HTMLDivElement;
  menu: HTMLDivElement;
  menuParent: HTMLDivElement;
  menuOption: HTMLButtonElement;
};

const fixtureContainers: HTMLElement[] = [];
const portalCleanups: (() => void)[] = [];

/** Tracks observer and portal teardown even when an assertion fails. */
const mountTrackedSlashMenuPortal = (
  options: Parameters<typeof mountMarkdownEditorSlashMenuPortal>[0],
): (() => void) => {
  const cleanup = mountMarkdownEditorSlashMenuPortal(options);
  portalCleanups.push(cleanup);
  return cleanup;
};

/** Creates one editor-shaped DOM fixture with a Crepe slash menu. */
const createSlashMenuFixture = (menuRect: DOMRect): ISlashMenuFixture => {
  const editorContainer = document.createElement('div');
  const editorWrapper = document.createElement('div');
  const menuParent = document.createElement('div');
  const menu = document.createElement('div');
  const menuOption = document.createElement('button');

  editorContainer.dataset['markdownEditorLayout'] = 'compact';
  editorWrapper.dataset['slot'] = 'markdown-editor';
  menuParent.className = 'milkdown';
  menu.className = 'milkdown-slash-menu';
  menu.dataset['show'] = 'false';
  menu.style.cssText = 'left: 4px; position: absolute; top: 6px;';
  menu.getBoundingClientRect = () => menuRect;
  menuOption.type = 'button';
  menuOption.textContent = 'Heading';
  menu.append(menuOption);
  menuParent.append(menu);
  editorWrapper.append(menuParent);
  editorContainer.append(editorWrapper);
  document.body.append(editorContainer);
  fixtureContainers.push(editorContainer);

  return { editorContainer, editorWrapper, menu, menuOption, menuParent };
};

/** Flushes queued mutation-observer callbacks. */
const flushMutationObservers = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

/** Reproduces Crepe's visibility change followed by its asynchronous position write. */
const showSlashMenu = async (fixture: ISlashMenuFixture): Promise<void> => {
  fixture.menu.dataset['show'] = 'true';
  await vi.waitFor(() => {
    expect(fixture.menu.dataset['markdownEditorPositionPending']).toBe('true');
  });
  fixture.menu.style.left = '4px';
  fixture.menu.style.top = '6px';
  await vi.waitFor(() => {
    expect(fixture.menu.parentElement?.dataset['slot']).toBe('markdown-editor-slash-menu-portal');
  });
};

afterEach(() => {
  for (const cleanup of portalCleanups) {
    cleanup();
  }
  for (const fixtureContainer of fixtureContainers) {
    fixtureContainer.remove();
  }
  portalCleanups.length = 0;
  fixtureContainers.length = 0;
  vi.restoreAllMocks();
});

describe('markdown editor slash-menu portal', () => {
  test.each([
    ['top left', new DOMRect(-40, -50, 100, 100), { left: 8, top: 8 }],
    ['top right', new DOMRect(630, -50, 100, 100), { left: 532, top: 8 }],
    ['bottom left', new DOMRect(-40, 470, 100, 100), { left: 8, top: 372 }],
    ['bottom right', new DOMRect(630, 470, 100, 100), { left: 532, top: 372 }],
  ])(
    'clamps the %s edge into a 640 by 480 viewport',
    { tags: ['full'] },
    (_edge, menuRect, expectedPosition) => {
      expect(getClampedMarkdownEditorSlashMenuPosition(menuRect, 480, 640)).toStrictEqual(
        expectedPosition,
      );
    },
  );

  test('portals a visible menu with fixed geometry while preserving its interactions', async () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(480);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(640);

    const fixture = createSlashMenuFixture(new DOMRect(620, 460, 240, 200));
    const handlePointerSelection = vi.fn();
    const handleKeyboardSelection = vi.fn();
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'editor-one',
    });

    fixture.menuOption.addEventListener('click', handlePointerSelection);
    fixture.menuOption.addEventListener('keydown', handleKeyboardSelection);
    await showSlashMenu(fixture);

    const portal = document.querySelector<HTMLElement>(
      '[data-slot="markdown-editor-slash-menu-portal"]',
    );

    expect(portal?.dataset['markdownEditorLayout']).toBe('compact');
    expect(portal?.getAttribute('data-markdown-editor-slash-menu-owner')).toBe('editor-one');
    expect(fixture.menu.parentElement).toBe(portal);
    expect(fixture.menu.getAttribute('data-markdown-editor-slash-menu-owner')).toBe('editor-one');
    expect(fixture.menu.style.position).toBe('fixed');
    expect(fixture.menu.style.left).toBe('392px');
    expect(fixture.menu.style.top).toBe('272px');
    expect(fixture.menu.style.zIndex).toBe('70');

    fixture.menuOption.click();
    fixture.menuOption.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

    expect(handlePointerSelection).toHaveBeenCalledOnce();
    expect(handleKeyboardSelection).toHaveBeenCalledOnce();

    fixture.menu.dataset['show'] = 'false';
    await flushMutationObservers();

    expect(fixture.menu.parentElement).toBe(fixture.menuParent);
    expect(fixture.menu.getAttribute('data-markdown-editor-slash-menu-owner')).toBeNull();
    expect({
      left: fixture.menu.style.left,
      position: fixture.menu.style.position,
      top: fixture.menu.style.top,
      zIndex: fixture.menu.style.zIndex,
    }).toStrictEqual({ left: '4px', position: 'absolute', top: '6px', zIndex: '' });
    expect(portal?.isConnected).toBe(false);

    cleanup();
    fixture.editorContainer.remove();
  });

  test('detached documents and already owned menus do not create a second portal', async () => {
    const detachedDocument = document.implementation.createHTMLDocument();
    const detachedWrapper = detachedDocument.createElement('div');
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: detachedWrapper,
      ownerId: 'detached',
    });
    cleanup();
    const fixture = createSlashMenuFixture(new DOMRect(20, 30, 220, 180));
    fixture.menu.dataset['show'] = 'true';
    fixture.menu.setAttribute('data-markdown-editor-slash-menu-owner', 'other-editor');
    mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'current-editor',
    });
    await flushMutationObservers();
    expect(fixture.menu.parentElement).toBe(fixture.menuParent);
    expect(document.querySelector('[data-slot="markdown-editor-slash-menu-portal"]')).toBeNull();
  });

  test('replacing a pending menu restores its old position and tracks viewport changes without a layout ancestor', async () => {
    const fixture = createSlashMenuFixture(new DOMRect(20, 30, 220, 180));
    fixture.editorContainer.removeAttribute('data-markdown-editor-layout');
    mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'replacement-editor',
    });
    fixture.menu.dataset['show'] = 'true';
    await vi.waitFor(() =>
      expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(true),
    );
    const replacement = fixture.menu.cloneNode(true) as HTMLDivElement;
    replacement.removeAttribute('data-markdown-editor-position-pending');
    replacement.style.left = '40px';
    replacement.style.top = '50px';
    fixture.menu.dataset['show'] = 'false';
    fixture.menuParent.append(replacement);
    await vi.waitFor(() =>
      expect(replacement.parentElement?.dataset['slot']).toBe('markdown-editor-slash-menu-portal'),
    );
    expect(fixture.menu.style.left).toBe('4px');
    expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(false);
    expect(replacement.parentElement?.hasAttribute('data-markdown-editor-layout')).toBe(false);
    vi.spyOn(replacement, 'getBoundingClientRect').mockReturnValue(new DOMRect(-20, -30, 220, 180));
    window.dispatchEvent(new Event('resize'));
    expect(replacement.style.left).toBe('8px');
    expect(replacement.style.top).toBe('8px');
  });

  test('a second unpositioned menu restores the first pending menu before awaiting its own position', async () => {
    const fixture = createSlashMenuFixture(new DOMRect(20, 30, 220, 180));
    mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'pending-replacement',
    });
    fixture.menu.dataset['show'] = 'true';
    await vi.waitFor(() =>
      expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(true),
    );
    const replacement = document.createElement('div');
    replacement.className = 'milkdown-slash-menu';
    replacement.dataset['show'] = 'true';
    fixture.menu.dataset['show'] = 'false';
    fixture.menuParent.append(replacement);
    await vi.waitFor(() =>
      expect(replacement.hasAttribute('data-markdown-editor-position-pending')).toBe(true),
    );
    expect(fixture.menu.style.left).toBe('4px');
    expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(false);
    replacement.style.left = '40px';
    replacement.style.top = '50px';
    await vi.waitFor(() =>
      expect(replacement.parentElement?.dataset['slot']).toBe('markdown-editor-slash-menu-portal'),
    );
  });

  test('keeps simultaneous editors isolated by owner', async () => {
    const firstFixture = createSlashMenuFixture(new DOMRect(20, 30, 220, 180));
    const secondFixture = createSlashMenuFixture(new DOMRect(260, 30, 220, 180));
    const cleanupFirst = mountTrackedSlashMenuPortal({
      editorWrapper: firstFixture.editorWrapper,
      ownerId: 'editor-one',
    });
    const cleanupSecond = mountTrackedSlashMenuPortal({
      editorWrapper: secondFixture.editorWrapper,
      ownerId: 'editor-two',
    });

    await showSlashMenu(firstFixture);
    await showSlashMenu(secondFixture);

    const firstPortal = document.querySelector(
      '[data-slot="markdown-editor-slash-menu-portal"][data-markdown-editor-slash-menu-owner="editor-one"]',
    );
    const secondPortal = document.querySelector(
      '[data-slot="markdown-editor-slash-menu-portal"][data-markdown-editor-slash-menu-owner="editor-two"]',
    );

    expect(firstFixture.menu.parentElement).toBe(firstPortal);
    expect(secondFixture.menu.parentElement).toBe(secondPortal);

    firstFixture.menu.dataset['show'] = 'false';
    await flushMutationObservers();

    expect(firstFixture.menu.parentElement).toBe(firstFixture.menuParent);
    expect(secondFixture.menu.parentElement).toBe(secondPortal);
    expect(secondPortal?.isConnected).toBe(true);

    cleanupFirst();
    cleanupSecond();
    firstFixture.editorContainer.remove();
    secondFixture.editorContainer.remove();
  });

  test(
    'reclamps Crepe position updates after the menu has moved to the body portal',
    { tags: ['full'] },
    async () => {
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(480);
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(640);

      const fixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
      const cleanup = mountTrackedSlashMenuPortal({
        editorWrapper: fixture.editorWrapper,
        ownerId: 'editor-one',
      });

      await showSlashMenu(fixture);
      fixture.menu.style.left = '900px';
      fixture.menu.style.top = '700px';
      await flushMutationObservers();

      expect(fixture.menu.style.left).toBe('412px');
      expect(fixture.menu.style.top).toBe('292px');

      cleanup();
      fixture.editorContainer.remove();
    },
  );

  test('restores the original sibling order and uses measured geometry when Crepe clears inline coordinates', async () => {
    const fixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const sibling = document.createElement('div');
    fixture.menu.after(sibling);
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'sibling-editor',
    });
    await showSlashMenu(fixture);
    fixture.menu.style.left = '';
    fixture.menu.style.top = '';
    await flushMutationObservers();
    expect(fixture.menu.style.left).toBe('40px');
    expect(fixture.menu.style.top).toBe('50px');
    cleanup();
    expect(fixture.menu.nextSibling).toBe(sibling);
  });

  test('cleanup preserves a menu that another owner has taken over', async () => {
    const fixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'previous-editor',
    });
    await showSlashMenu(fixture);
    fixture.menu.setAttribute('data-markdown-editor-slash-menu-owner', 'next-editor');
    const nextParent = document.createElement('div');
    fixture.editorWrapper.append(nextParent);
    nextParent.append(fixture.menu);
    cleanup();
    expect(fixture.menu.parentElement).toBe(nextParent);
    expect(fixture.menu.getAttribute('data-markdown-editor-slash-menu-owner')).toBe('next-editor');
  });

  test('restores an open menu on unmount and removes a portal left by editor destruction', async () => {
    const unmountFixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const cleanupUnmountedEditor = mountTrackedSlashMenuPortal({
      editorWrapper: unmountFixture.editorWrapper,
      ownerId: 'unmounting-editor',
    });

    await showSlashMenu(unmountFixture);
    cleanupUnmountedEditor();

    expect(unmountFixture.menu.parentElement).toBe(unmountFixture.menuParent);
    expect(
      document.querySelector('[data-markdown-editor-slash-menu-owner="unmounting-editor"]'),
    ).toBeNull();

    const destroyedFixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const cleanupDestroyedEditor = mountTrackedSlashMenuPortal({
      editorWrapper: destroyedFixture.editorWrapper,
      ownerId: 'destroyed-editor',
    });

    await showSlashMenu(destroyedFixture);
    destroyedFixture.menu.remove();
    await flushMutationObservers();

    expect(
      document.querySelector('[data-markdown-editor-slash-menu-owner="destroyed-editor"]'),
    ).toBeNull();

    cleanupDestroyedEditor();
    unmountFixture.editorContainer.remove();
    destroyedFixture.editorContainer.remove();
  });

  test('waits for the initial parent-relative position on a scrolled page before reparenting', async () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800);
    const fixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'scrolled-editor',
    });

    try {
      fixture.menu.dataset['show'] = 'true';
      await flushMutationObservers();

      expect(fixture.menu.parentElement).toBe(fixture.menuParent);
      expect(fixture.menu.dataset['markdownEditorPositionPending']).toBe('true');

      fixture.menu.style.left = '10px';
      fixture.menu.style.top = '20px';
      await flushMutationObservers();

      expect(fixture.menu.parentElement?.dataset['slot']).toBe('markdown-editor-slash-menu-portal');
      expect(fixture.menu.style.left).toBe('40px');
      expect(fixture.menu.style.top).toBe('50px');
      expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(false);

      // later Crepe calculations use document coordinates after the menu is portaled.
      fixture.menu.style.left = '40px';
      fixture.menu.style.top = '850px';
      await flushMutationObservers();

      expect(fixture.menu.style.top).toBe('50px');
    } finally {
      cleanup();
      fixture.editorContainer.remove();
    }
  });

  test('releases a pending menu when dismissed or unmounted before positioning completes', async () => {
    const fixture = createSlashMenuFixture(new DOMRect(40, 50, 220, 180));
    const cleanup = mountTrackedSlashMenuPortal({
      editorWrapper: fixture.editorWrapper,
      ownerId: 'pending-editor',
    });

    try {
      fixture.menu.dataset['show'] = 'true';
      await flushMutationObservers();
      expect(fixture.menu.dataset['markdownEditorPositionPending']).toBe('true');

      fixture.menu.dataset['show'] = 'false';
      await flushMutationObservers();
      expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(false);
      expect(fixture.menu.style.left).toBe('4px');
      expect(fixture.menu.style.top).toBe('6px');

      fixture.menu.dataset['show'] = 'true';
      await flushMutationObservers();
      cleanup();
      expect(fixture.menu.hasAttribute('data-markdown-editor-position-pending')).toBe(false);
      expect(fixture.menu.parentElement).toBe(fixture.menuParent);
      expect(fixture.menu.style.left).toBe('4px');
      expect(fixture.menu.style.top).toBe('6px');
    } finally {
      cleanup();
      fixture.editorContainer.remove();
    }
  });

  test(
    'keeps fractional viewport positions stable when the browser rounds inline styles',
    { tags: ['full'] },
    async () => {
      vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800);
      const fixture = createSlashMenuFixture(new DOMRect(40, 50.12345678, 220, 180));
      Object.defineProperty(fixture.menu.style, 'top', {
        configurable: true,
        get: () => fixture.menu.style.getPropertyValue('top'),
        set: (position: string) => {
          fixture.menu.style.setProperty('top', `${Number.parseFloat(position).toFixed(3)}px`);
        },
      });
      const cleanup = mountTrackedSlashMenuPortal({
        editorWrapper: fixture.editorWrapper,
        ownerId: 'fractional-editor',
      });

      try {
        await showSlashMenu(fixture);
        await flushMutationObservers();

        expect(fixture.menu.parentElement?.dataset['slot']).toBe(
          'markdown-editor-slash-menu-portal',
        );
        expect(fixture.menu.style.top).toBe('50.123px');
      } finally {
        cleanup();
        fixture.editorContainer.remove();
      }
    },
  );
});
