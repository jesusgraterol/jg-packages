import type * as React from 'react';
import type { Tabs as BaseTabs } from '@base-ui/react/tabs';

/** Tab activation modes supported by the shared tabs root.
 * @see Tabs
 */
export type ITabsActivationMode = 'automatic' | 'manual';

/** Scroll preserves complete natural-width labels; truncate is an explicit constrained exception.
 * @see Tabs
 */
export type ITabsOverflowBehavior = 'scroll' | 'truncate';

/** Native attributes and shared options for Tabs.
 * @see Tabs
 */
export type ITabsProps = Omit<React.ComponentProps<typeof BaseTabs.Root>, 'activationMode'> & {
  activationMode?: ITabsActivationMode;
};
/** Native attributes and shared options for TabsList.
 * @see TabsList
 */
export type ITabsListProps = React.ComponentProps<typeof BaseTabs.List> & {
  overflowBehavior: ITabsOverflowBehavior;
};
/** Native attributes and shared options for TabsTrigger.
 * @see TabsTrigger
 */
export type ITabsTriggerProps = Omit<
  React.ComponentProps<typeof BaseTabs.Tab>,
  'nativeButton' | 'render'
> & {
  asChild?: boolean;
};
/** Native attributes and shared options for TabsContent.
 * @see TabsContent
 */
export type ITabsContentProps = React.ComponentProps<typeof BaseTabs.Panel> & {
  forceMount?: boolean;
};
