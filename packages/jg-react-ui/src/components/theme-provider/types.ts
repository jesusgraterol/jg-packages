import type * as React from 'react';
import type { IAppTheme, IResolvedAppTheme } from '../../contracts/index.js';

import type { IButtonProps } from '../button/index.js';

/** Theme provider props configure children and transition behavior.
 * @see ThemeProvider
 */
export type IThemeProviderProps = {
  children: React.ReactNode;
  disableTransitionOnChange?: boolean;
};

/** Theme context state is the public contract returned by useTheme.
 * @see ThemeProvider
 */
export type IThemeProviderState = {
  theme: IAppTheme;
  resolvedTheme: IResolvedAppTheme;
  setTheme: (theme: IAppTheme) => void;
};

/** Theme-toggle callbacks report the requested resolved theme after dispatch.
 * @see ThemeProvider
 */
export type IThemeChangeRequestedHandler = (nextTheme: IResolvedAppTheme) => void;

/** Theme toggle props preserve Button styling while reserving theme-owned content and behavior.
 * @see ThemeProvider
 */
export type IThemeToggleButtonProps = Omit<
  IButtonProps,
  'aria-label' | 'children' | 'onClick' | 'title'
> & {
  onThemeChangeRequested?: IThemeChangeRequestedHandler;
};

/** Initialization props expose only host-safe script attributes.
 * @see ThemeProvider
 */
export type IThemeInitializationScriptProps = Pick<
  React.ComponentProps<'script'>,
  'id' | 'nonce'
> & { storageId?: string };
