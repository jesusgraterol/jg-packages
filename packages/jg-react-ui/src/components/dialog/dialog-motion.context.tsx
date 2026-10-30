import { createContext } from 'react';

// the popup identifies its owning root without changing consumer refs or panel elements.
export const DialogMotionContext = createContext<string | undefined>(undefined);
