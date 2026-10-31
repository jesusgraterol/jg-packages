import { createContext } from 'react';

import type { IThemeProviderState } from './types.js';

// theme context stays undefined until a provider supplies state.
export const ThemeProviderContext = createContext<IThemeProviderState | undefined>(undefined);
