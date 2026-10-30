import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  DEFAULT_UI_PREFERENCES,
  ErrorFeedbackProvider,
  ThemeProvider,
  Toastr,
  UiPreferencesProvider,
  type IUiPreferences,
} from 'jg-personal-react-ui';

import { Gallery } from './gallery.component.js';
import './styles.css';

declare const __JG_UI_STORAGE_ID__: string;
const requestedTheme = new URLSearchParams(location.search).get('theme');
const initialPreferences: IUiPreferences | undefined =
  requestedTheme === 'light' || requestedTheme === 'dark'
    ? { ...DEFAULT_UI_PREFERENCES, theme: requestedTheme }
    : undefined;

const root = document.getElementById('root');
if (root === null) throw new Error('The gallery root is missing.');
createRoot(root).render(
  <StrictMode>
    <ErrorFeedbackProvider>
      <UiPreferencesProvider
        mode="local"
        storageId={__JG_UI_STORAGE_ID__}
        {...(initialPreferences === undefined ? {} : { initialPreferences })}
      >
        <ThemeProvider>
          <Gallery />
          <Toastr
            closeButton
            toastOptions={{ duration: Infinity }}
          />
        </ThemeProvider>
      </UiPreferencesProvider>
    </ErrorFeedbackProvider>
  </StrictMode>,
);
