import { createElement, useEffect, useMemo, type KeyboardEvent, type ReactElement } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { cn } from 'cnfast';
import { prefersReducedMotion } from 'jg-utilities';

import {
  MARKDOWN_EDITOR_TURN_INTO_MENU_WIDTH,
  MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES,
} from './constants.js';
import type {
  IMarkdownEditorBlockActionMenuProps,
  IMarkdownEditorTurnIntoOption,
} from './types.js';
import { getVisibleMarkdownEditorTurnIntoOptions } from './tool-policy.utilities.js';

const MENU_NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * Scrolls a menu back to the first action with the preferred motion behavior.
 * @param menu The scrollable menu element.
 */
const scrollMarkdownEditorMenuToTop = (menu: HTMLElement): void => {
  if (typeof menu.scrollTo !== 'function') {
    menu.scrollTop = 0;
    return;
  }

  menu.scrollTo({
    behavior: prefersReducedMotion(menu.ownerDocument.defaultView) ? 'auto' : 'smooth',
    top: 0,
  });
};

/**
 * Renders the icon for a turn-into option.
 * @param option The block type option rendered by the menu.
 * @returns A React element that renders the option icon.
 */
const MarkdownEditorTurnIntoOptionIcon = ({
  option,
}: {
  option: IMarkdownEditorTurnIntoOption;
}): ReactElement => {
  const iconNode = MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES[option.kind];

  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      data-editor-icon="outline"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {iconNode.map(([elementName, attributes], index) => {
        const iconKey = `${elementName}-${index}`;

        return createElement(elementName, {
          ...attributes,
          key: iconKey,
        });
      })}
    </svg>
  );
};

/**
 * Renders the floating block action menu for the selected editor row.
 * @param props The positioned menu props and block action callbacks.
 * @returns A React element that renders turn-into and delete commands.
 */
export const MarkdownEditorBlockActionMenu = ({
  activeKind,
  left,
  maxHeight,
  menuRef,
  onClose,
  onDelete,
  onTurnInto,
  supportedTools,
  target,
  top,
}: IMarkdownEditorBlockActionMenuProps): ReactElement => {
  const visibleOptions = useMemo(
    () => getVisibleMarkdownEditorTurnIntoOptions(supportedTools),
    [supportedTools],
  );
  const canTurnInto = visibleOptions.length > 0;

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [menuRef]);

  useEffect(() => {
    const menu = menuRef.current;

    if (menu) scrollMarkdownEditorMenuToTop(menu);
  }, [left, menuRef, target.from, target.to, top]);

  /**
   * Handles keyboard dismissal for the floating menu.
   * @param event The keyboard event emitted by the menu.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (!MENU_NAVIGATION_KEYS.has(event.key)) return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const currentIndex = items.findIndex((item) => item === item.ownerDocument.activeElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (currentIndex + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      ref={menuRef}
      aria-label="Block actions"
      className="bg-background text-foreground shadow-raised fixed z-50 grid grid-cols-1 gap-1 overflow-y-auto overscroll-contain rounded-lg border border-border p-1 text-sm outline-none"
      data-slot="markdown-editor-block-action-menu"
      onKeyDown={handleKeyDown}
      role="menu"
      style={{
        left,
        maxHeight,
        top,
        width: MARKDOWN_EDITOR_TURN_INTO_MENU_WIDTH,
      }}
    >
      {canTurnInto ? (
        <>
          <p className="text-secondary-foreground px-2 py-1.5 text-xs leading-none font-medium">
            Turn into
          </p>
          {visibleOptions.map((option) => {
            const isActive = activeKind === option.kind;

            return (
              <button
                aria-checked={isActive}
                className={cn(
                  'hover:bg-secondary focus-visible:ring-foreground focus-visible:ring-offset-background grid h-8 pointer-coarse:min-h-11 grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-md px-2 text-left transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  isActive ? 'bg-secondary text-foreground' : null,
                )}
                key={option.kind}
                onClick={() => {
                  onTurnInto(option);
                }}
                role="menuitemradio"
                type="button"
              >
                <MarkdownEditorTurnIntoOptionIcon option={option} />
                <span className="truncate">{option.label}</span>
                {isActive ? (
                  <Check
                    aria-hidden="true"
                    className="size-4"
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
              </button>
            );
          })}
          <div
            className="bg-border -mx-1 my-1 h-px"
            role="separator"
          />
        </>
      ) : null}
      <button
        className="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive focus-visible:ring-offset-background grid h-8 pointer-coarse:min-h-11 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 text-left transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        onClick={onDelete}
        role="menuitem"
        type="button"
      >
        <Trash2
          aria-hidden="true"
          className="size-4 shrink-0"
        />
        <span className="truncate">Delete row</span>
      </button>
    </div>
  );
};

// internal menu component rendered by the markdown editor portal.
