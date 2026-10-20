import type { IThemePreference } from 'jg-site';

// how useAppliedTheme applies the theme
export type IAppliedThemeOptions = {
  // turns transitions off while the theme class changes, so colors switch at once. Defaults to true
  disableTransitionsOnChange?: boolean | undefined;
};

// what createThemeInitScript reads the stored preference from
export type IThemeInitScriptOptions = {
  // the localStorage key holding the preference, such as `jg-storage:preferences`
  storageKey: string;

  // the field of a stored object that holds the preference, such as `theme`
  field?: string | undefined;

  // the preference used when none is stored or it isn't valid. Defaults to 'system'
  defaultPreference?: IThemePreference | undefined;
};
