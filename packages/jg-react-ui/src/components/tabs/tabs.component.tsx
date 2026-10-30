import { createContext, isValidElement, useCallback, useContext } from 'react';
import type * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from 'cnfast';

import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import type {
  ITabsActivationMode,
  ITabsContentProps,
  ITabsListProps,
  ITabsOverflowBehavior,
  ITabsProps,
  ITabsTriggerProps,
} from './types.js';

const TabsActivationModeContext = createContext<ITabsActivationMode>('automatic');
const TabsOverflowBehaviorContext = createContext<ITabsOverflowBehavior | null>(null);

/**
 * Provides the tabs root state and orientation context.
 * @param props The Base UI tabs root props and activation mode.
 * @returns A React element that renders the tabs root.
 * @example
 * import { createElement } from 'react';
 * import { Tabs } from 'jg-react-ui/components/tabs';
 * const example = createElement(Tabs, { children: 'Project settings' });
 */
export const Tabs = ({
  activationMode = 'automatic',
  className,
  orientation = 'horizontal',
  ...props
}: ITabsProps): React.ReactElement => (
  <TabsActivationModeContext value={activationMode}>
    <BaseTabs.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  </TabsActivationModeContext>
);

/**
 * Renders the segmented control container for tab triggers.
 * @param props The Base UI tabs list props.
 * @returns A React element that renders the tabs list.
 * @example
 * import { createElement } from 'react';
 * import { TabsList } from 'jg-react-ui/components/tabs';
 * const example = createElement(TabsList, { overflowBehavior: 'scroll', 'aria-label': 'Project views' });
 */
export const TabsList = ({
  activateOnFocus,
  className,
  overflowBehavior,
  onFocusCapture,
  ref,
  children,
  ...props
}: ITabsListProps): React.ReactElement => {
  const activationMode = useContext(TabsActivationModeContext);
  const handleRef = useCallback(
    (list: HTMLDivElement) => {
      const refCleanup = typeof ref === 'function' ? ref(list) : undefined;
      if (ref && typeof ref !== 'function') ref.current = list;

      const observer =
        overflowBehavior === 'scroll' && typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => revealFocusedTab(list, list.ownerDocument.activeElement))
          : undefined;
      observer?.observe(list);

      return () => {
        observer?.disconnect();
        if (typeof refCleanup === 'function') refCleanup();
        else if (typeof ref === 'function') ref(null);
        else if (ref) ref.current = null;
      };
    },
    [ref, overflowBehavior],
  );
  const handleFocusCapture = useCallback<NonNullable<ITabsListProps['onFocusCapture']>>(
    (event) => {
      onFocusCapture?.(event);
      if (event.defaultPrevented || overflowBehavior !== 'scroll') return;
      revealFocusedTab(event.currentTarget, event.target);
    },
    [onFocusCapture, overflowBehavior],
  );

  return (
    <TabsOverflowBehaviorContext value={overflowBehavior}>
      <BaseTabs.List
        data-slot="tabs-list"
        data-overflow-behavior={overflowBehavior}
        activateOnFocus={activateOnFocus ?? activationMode === 'automatic'}
        ref={handleRef}
        onFocusCapture={handleFocusCapture}
        className={cn(
          'bg-secondary text-secondary-foreground inline-flex min-h-13 w-fit max-w-full min-w-0 items-center justify-start rounded-lg p-1 sm:pointer-fine:min-h-8',
          overflowBehavior === 'scroll' &&
            'touch-auto scroll-px-1 [scrollbar-width:thin] overflow-x-auto overflow-y-hidden overscroll-x-contain',
          overflowBehavior === 'truncate' && 'overflow-hidden',
          className,
        )}
        {...props}
      >
        {children}
      </BaseTabs.List>
    </TabsOverflowBehaviorContext>
  );
};

/** Keeps keyboard focus visible without changing the selected tab or animating the scroll. */
const revealFocusedTab = (list: HTMLElement, target: Element | null): void => {
  const tab = target?.closest<HTMLElement>('[role="tab"]');
  if (!tab || tab.closest('[role="tablist"]') !== list) return;
  const listBounds = list.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  if (tabBounds.left < listBounds.left || tabBounds.right > listBounds.right)
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
};

/**
 * Renders an individual tab selection control.
 * @param props The Base UI tabs trigger props and optional slot rendering flag.
 * @returns A React element that renders the tabs trigger.
 * @example
 * import { createElement } from 'react';
 * import { TabsTrigger } from 'jg-react-ui/components/tabs';
 * const example = createElement(TabsTrigger, { value: 'overview', children: 'Overview' });
 * @throws
 * - TabsTrigger must be rendered inside TabsList.
 * - TabsTrigger with composite children requires title or aria-label when TabsList truncates.
 * - TabsTrigger asChild requires exactly one valid React element child.
 */
export const TabsTrigger = ({
  asChild = false,
  'aria-label': ariaLabel,
  children,
  className,
  title,
  ...props
}: ITabsTriggerProps): React.ReactElement => {
  const overflowBehavior = useContext(TabsOverflowBehaviorContext);

  if (overflowBehavior === null) {
    throw new Error('TabsTrigger must be rendered inside TabsList.');
  }

  const isSimpleLabel = typeof children === 'string' || typeof children === 'number';

  if (overflowBehavior === 'truncate' && !isSimpleLabel && !title && !ariaLabel) {
    throw new Error(
      'TabsTrigger with composite children requires title or aria-label when TabsList truncates.',
    );
  }

  return (
    <BaseTabs.Tab
      data-slot="tabs-trigger"
      nativeButton={!asChild || isNativeButtonRender(children)}
      render={asChild ? resolveTabsTriggerRender(children) : undefined}
      aria-label={ariaLabel}
      title={overflowBehavior === 'truncate' && isSimpleLabel ? (title ?? String(children)) : title}
      className={cn(
        'focus-visible:ring-foreground focus-visible:ring-offset-background data-active:bg-background data-active:text-foreground data-active:shadow-inset dark:data-active:border-border dark:data-active:bg-border/30 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none not-disabled:not-aria-disabled:hover:[text-shadow:0_0_0_currentColor,0.02em_0_0_currentColor,-0.02em_0_0_currentColor] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-active:[text-shadow:0_0_0_currentColor,0.02em_0_0_currentColor,-0.02em_0_0_currentColor] focus-visible:data-active:border-transparent! focus-visible:data-active:shadow-none motion-reduce:transition-none sm:pointer-fine:h-6',
        overflowBehavior === 'scroll' && 'shrink-0 scroll-mx-1',
        overflowBehavior === 'truncate' && 'min-w-0 overflow-hidden text-ellipsis',
        className,
      )}
      {...props}
    >
      {asChild ? undefined : children}
    </BaseTabs.Tab>
  );
};

/**
 * Renders the panel content associated with a selected tab.
 * @param props The Base UI tabs panel props and mount behavior.
 * @returns A React element that renders the tabs content.
 * @example
 * import { createElement } from 'react';
 * import { TabsContent } from 'jg-react-ui/components/tabs';
 * const example = createElement(TabsContent, { value: 'overview', children: 'Project overview' });
 */
export const TabsContent = ({
  className,
  forceMount,
  keepMounted,
  ...props
}: ITabsContentProps): React.ReactElement => (
  <BaseTabs.Panel
    data-slot="tabs-content"
    keepMounted={keepMounted ?? forceMount}
    className={cn(
      'focus-visible:ring-foreground focus-visible:ring-offset-background min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
);

/**
 * Resolves the render element used by Base UI for TabsTrigger asChild rendering.
 * @param children The trigger children provided by the consumer.
 * @returns A valid React element for Base UI's render prop.
 */
const resolveTabsTriggerRender = (children: React.ReactNode): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error('TabsTrigger asChild requires exactly one valid React element child.');
  }

  return children;
};
