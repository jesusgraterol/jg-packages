// a theme the visitor can choose: the system's, or a fixed light or dark one
export type IThemePreference = 'system' | 'light' | 'dark';

// the theme the page applies: light or dark
export type IResolvedTheme = Exclude<IThemePreference, 'system'>;

// the storage the preference is read from and written to, such as localStorage
export type IThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
