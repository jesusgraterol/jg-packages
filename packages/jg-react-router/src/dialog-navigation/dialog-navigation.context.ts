import { createContext } from 'react';

import type { IDialogNavigationContext } from './types.js';

// the surrounding provider's registry, or null outside one, where dialogs need no router
export const DialogNavigationContext = createContext<IDialogNavigationContext | null>(null);
