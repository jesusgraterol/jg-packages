import { createContext } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import type { IUiPreferencesStore } from './types.js';

// every mounted provider supplies its own store; no mutable default store is shared
export const UiPreferencesStoreContext = createContext<StoreApi<IUiPreferencesStore> | undefined>(
  undefined,
);
