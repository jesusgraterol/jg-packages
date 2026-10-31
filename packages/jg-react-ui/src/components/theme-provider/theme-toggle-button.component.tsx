import type * as React from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '../button/index.js';
import { useUiPreferencesCapabilities } from '../ui-preferences-provider/index.js';
import type { IThemeToggleButtonProps } from './types.js';
import { useTheme } from './theme.hook.js';

/**
 * Renders an accessible action that toggles between the resolved light and dark themes.
 * @param props The shared Button styling, disabled state, and optional request callback.
 * @returns A React element that renders the theme toggle.
 * @example
 * import { createElement } from 'react';
 * import { ThemeToggleButton } from 'jg-react-ui/components/theme-provider';
 * const toggle = createElement(ThemeToggleButton, { size: 'icon-touch' });
 * @throws
 * - THEME_PROVIDER_MISSING: useTheme must be used within a ThemeProvider
 */
export const ThemeToggleButton = ({
  disabled = false,
  onThemeChangeRequested,
  ...props
}: IThemeToggleButtonProps): React.ReactElement => {
  const { resolvedTheme, setTheme } = useTheme();
  const { canUpdatePreferences, isPreferencesUpdatePending } = useUiPreferencesCapabilities();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'dark' ? 'Switch to dark theme' : 'Switch to light theme';
  const ThemeIcon = nextTheme === 'dark' ? Moon : Sun;

  return (
    <Button
      {...props}
      aria-label={label}
      disabled={disabled || !canUpdatePreferences || isPreferencesUpdatePending}
      title={label}
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        onThemeChangeRequested?.(nextTheme);
      }}
    >
      <ThemeIcon aria-hidden="true" />
    </Button>
  );
};
