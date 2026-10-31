import {
  MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  MARKDOWN_EDITOR_SLASH_MENU_Z_INDEX,
} from './constants.js';
import type {
  IMarkdownEditorMenuFixedPosition,
  IMarkdownEditorMenuViewportRect,
  IMarkdownEditorSlashMenuPortalOptions,
} from './types.js';

const MARKDOWN_EDITOR_SLASH_MENU_SELECTOR = '.milkdown-slash-menu';
const MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE = 'data-markdown-editor-slash-menu-owner';
const MARKDOWN_EDITOR_SLASH_MENU_PORTAL_SLOT = 'markdown-editor-slash-menu-portal';

type IActiveMarkdownEditorSlashMenuPortal = {
  appliedLeft: string;
  appliedTop: string;
  menu: HTMLElement;
  menuObserver: MutationObserver;
  originalNextSibling: ChildNode | null;
  originalParent: Node;
  originalStyle: string;
  portalContainer: HTMLDivElement;
};

/**
 * Clamps a slash-menu rectangle to fixed viewport coordinates.
 * @param menuRect The current menu rectangle in viewport coordinates.
 * @param viewportHeight The current viewport height.
 * @param viewportWidth The current viewport width.
 * @returns The fixed position that keeps the complete menu inside the viewport.
 */
export const getClampedMarkdownEditorSlashMenuPosition = (
  menuRect: IMarkdownEditorMenuViewportRect,
  viewportHeight: number,
  viewportWidth: number,
): IMarkdownEditorMenuFixedPosition => {
  const maxLeft = Math.max(
    MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
    viewportWidth - menuRect.width - MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  );
  const maxTop = Math.max(
    MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
    viewportHeight - menuRect.height - MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  );

  return {
    left: Math.min(
      Math.max(menuRect.left, MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING),
      maxLeft,
    ),
    top: Math.min(Math.max(menuRect.top, MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING), maxTop),
  };
};

/**
 * Moves the visible Crepe slash menu into an editor-owned body portal and restores it on close.
 * @param options The editor wrapper and stable owner identifier.
 * @returns A cleanup function that restores or removes only this editor's owned menu.
 */
export const mountMarkdownEditorSlashMenuPortal = ({
  editorWrapper,
  ownerId,
}: IMarkdownEditorSlashMenuPortalOptions): (() => void) => {
  const ownerDocument = editorWrapper.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;

  if (!ownerWindow) {
    return () => undefined;
  }

  let activePortal: IActiveMarkdownEditorSlashMenuPortal | null = null;
  let pendingMenu: HTMLElement | null = null;
  let pendingMenuStyle = '';

  /** Releases visibility suppression once Crepe supplies the menu's initial position. */
  const clearPendingMenu = (shouldRestoreStyle = false): void => {
    if (pendingMenu && shouldRestoreStyle) {
      pendingMenu.style.cssText = pendingMenuStyle;
    }
    pendingMenu?.removeAttribute('data-markdown-editor-position-pending');
    pendingMenu = null;
    pendingMenuStyle = '';
  };

  /** Applies a fixed, viewport-clamped position without replacing Crepe's menu element. */
  const applyPosition = (
    portal: IActiveMarkdownEditorSlashMenuPortal,
    menuRect: IMarkdownEditorMenuViewportRect,
  ): void => {
    const position = getClampedMarkdownEditorSlashMenuPosition(
      menuRect,
      ownerWindow.innerHeight,
      ownerWindow.innerWidth,
    );
    const left = `${position.left}px`;
    const top = `${position.top}px`;

    portal.menu.style.position = 'fixed';
    portal.menu.style.left = left;
    portal.menu.style.top = top;
    portal.menu.style.zIndex = String(MARKDOWN_EDITOR_SLASH_MENU_Z_INDEX);
    // browsers can round fractional pixel values when serializing inline styles.
    portal.appliedLeft = portal.menu.style.left;
    portal.appliedTop = portal.menu.style.top;
  };

  /** Releases the active portal, optionally restoring the still-owned menu to Crepe's parent. */
  const releasePortal = (shouldRestoreMenu: boolean): void => {
    const portal = activePortal;

    if (!portal) {
      return;
    }

    activePortal = null;
    portal.menuObserver.disconnect();

    if (portal.menu.getAttribute(MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE) === ownerId) {
      portal.menu.removeAttribute(MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE);
      portal.menu.style.cssText = portal.originalStyle;

      if (shouldRestoreMenu && portal.originalParent.isConnected && portal.menu.isConnected) {
        const insertionReference =
          portal.originalNextSibling?.parentNode === portal.originalParent
            ? portal.originalNextSibling
            : null;

        portal.originalParent.insertBefore(portal.menu, insertionReference);
      }
    }

    portal.portalContainer.remove();
  };

  /** Corrects a new Crepe position after the menu has moved to a fixed body portal. */
  const syncCrepePosition = (portal: IActiveMarkdownEditorSlashMenuPortal): void => {
    if (
      portal.menu.style.left === portal.appliedLeft &&
      portal.menu.style.top === portal.appliedTop &&
      portal.menu.style.position === 'fixed'
    ) {
      return;
    }

    const measuredRect = portal.menu.getBoundingClientRect();
    const parsedLeft = Number.parseFloat(portal.menu.style.left);
    const parsedTop = Number.parseFloat(portal.menu.style.top);
    const left = Number.isFinite(parsedLeft) ? parsedLeft - ownerWindow.scrollX : measuredRect.left;
    const top = Number.isFinite(parsedTop) ? parsedTop - ownerWindow.scrollY : measuredRect.top;

    applyPosition(portal, {
      height: measuredRect.height,
      left,
      top,
      width: measuredRect.width,
    });
  };

  /** Creates the portal for one visible, currently unowned slash menu. */
  const portalVisibleMenu = (menu: HTMLElement): void => {
    const existingOwner = menu.getAttribute(MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE);

    if (activePortal || existingOwner) {
      return;
    }

    // queried descendants have a parent throughout this synchronous portal operation.
    const originalParent = menu.parentNode!;

    const initialRect = menu.getBoundingClientRect();
    const portalContainer = ownerDocument.createElement('div');
    const layout = editorWrapper.closest<HTMLElement>('[data-markdown-editor-layout]')?.dataset[
      'markdownEditorLayout'
    ];

    portalContainer.className = 'milkdown';
    portalContainer.dataset['slot'] = MARKDOWN_EDITOR_SLASH_MENU_PORTAL_SLOT;
    portalContainer.setAttribute(MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE, ownerId);

    if (layout) {
      portalContainer.dataset['markdownEditorLayout'] = layout;
    }

    const menuObserver = new MutationObserver(() => {
      // releasing a portal disconnects its observer and discards queued records.
      const portal = activePortal!;

      if (!menu.isConnected) {
        releasePortal(false);
        return;
      }

      if (menu.dataset['show'] !== 'true') {
        releasePortal(true);
        return;
      }

      syncCrepePosition(portal);
    });

    activePortal = {
      appliedLeft: '',
      appliedTop: '',
      menu,
      menuObserver,
      originalNextSibling: menu.nextSibling,
      originalParent,
      originalStyle: menu.style.cssText,
      portalContainer,
    };

    menu.setAttribute(MARKDOWN_EDITOR_SLASH_MENU_OWNER_ATTRIBUTE, ownerId);
    ownerDocument.body.append(portalContainer);
    portalContainer.append(menu);
    menuObserver.observe(menu, {
      attributeFilter: ['data-show', 'style'],
      attributes: true,
    });
    menuObserver.observe(portalContainer, { childList: true });
    applyPosition(activePortal, initialRect);
  };

  /** Portals the visible menu rendered by this editor without touching another editor's menu. */
  const syncVisibleMenu = (mutations: MutationRecord[] = []): void => {
    if (activePortal) {
      return;
    }

    const visibleMenu = Array.from(
      editorWrapper.querySelectorAll<HTMLElement>(MARKDOWN_EDITOR_SLASH_MENU_SELECTOR),
    ).find((menu) => menu.dataset['show'] === 'true');

    if (!visibleMenu) {
      clearPendingMenu(true);
      return;
    }

    const wasShown = mutations.some(
      (mutation) => mutation.target === visibleMenu && mutation.attributeName === 'data-show',
    );
    const wasPositioned = mutations.some(
      (mutation) => mutation.target === visibleMenu && mutation.attributeName === 'style',
    );

    if (wasShown && !wasPositioned && pendingMenu !== visibleMenu) {
      clearPendingMenu(true);
      pendingMenu = visibleMenu;
      pendingMenuStyle = visibleMenu.style.cssText;
      visibleMenu.style.removeProperty('left');
      visibleMenu.style.removeProperty('top');
    }

    // Crepe shows the menu before its asynchronous, parent-relative position is ready.
    // Reparenting earlier makes that pending calculation use the wrong coordinate space.
    if (
      !visibleMenu.style.left ||
      !visibleMenu.style.top ||
      ((wasShown || pendingMenu === visibleMenu) && !wasPositioned)
    ) {
      if (pendingMenu !== visibleMenu) {
        clearPendingMenu(true);
        pendingMenu = visibleMenu;
        pendingMenuStyle = visibleMenu.style.cssText;
      }
      visibleMenu.setAttribute('data-markdown-editor-position-pending', 'true');
      return;
    }

    clearPendingMenu(pendingMenu !== visibleMenu);
    portalVisibleMenu(visibleMenu);
  };

  /** Keeps the already-fixed menu visible after viewport geometry changes. */
  const handleViewportChange = (): void => {
    const portal = activePortal;

    if (portal) {
      applyPosition(portal, portal.menu.getBoundingClientRect());
    }
  };

  const editorObserver = new MutationObserver(syncVisibleMenu);

  editorObserver.observe(editorWrapper, {
    attributeFilter: ['data-show', 'style'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  ownerDocument.addEventListener('scroll', handleViewportChange, true);
  ownerWindow.addEventListener('resize', handleViewportChange);
  syncVisibleMenu();

  return () => {
    editorObserver.disconnect();
    ownerDocument.removeEventListener('scroll', handleViewportChange, true);
    ownerWindow.removeEventListener('resize', handleViewportChange);
    clearPendingMenu(true);
    releasePortal(true);
  };
};
