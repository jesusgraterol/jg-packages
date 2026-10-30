# jg-react-ui recipes

App-side composition with the public surface.

## Use the public entry

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

## Style a navigation action

Use an explicit link role when the slotted child navigates.

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const settingsLink = createElement(
  Button,
  { asChild: true, variant: 'link', size: 'touch' },
  createElement('a', { href: '/settings', role: 'link' }, 'Settings'),
);
```

## Compose notices and status labels

Slot native elements when an entire notice is interactive. Keep supplementary actions on static alerts.

```ts
import { createElement } from 'react';
import { Alert, AlertTitle, AlertDescription, Badge, IconTile } from 'jg-react-ui';
const notice = createElement(
  Alert,
  { asChild: true, interaction: 'redirect' },
  createElement(
    'a',
    { href: '/activity' },
    createElement(AlertTitle, null, 'Review activity'),
    createElement(AlertDescription, null, 'Your latest updates are ready.'),
  ),
);
const status = createElement(Badge, { variant: 'success' }, 'Saved');
const step = createElement(IconTile, { tone: 'brand', 'aria-hidden': false }, '1');
```

## Scope application error feedback

Applications own their error messages and decide which codes mean that access was lost. Keep the resolver outside render so its identity remains stable.

```ts
import { createElement } from 'react';
import { createErrorFeedback } from 'jg-exception';
import { ErrorFeedbackProvider } from 'jg-react-ui/components/error-feedback-provider';
const resolveErrorFeedback = createErrorFeedback({
  fallbackMessage: 'We could not complete this action. Please try again.',
  messagesByCode: { SESSION_EXPIRED: 'Please sign in again.' },
  accessDeniedCodes: ['SESSION_EXPIRED'],
});
const app = createElement(ErrorFeedbackProvider, { resolveErrorFeedback, children: 'App' });
```

## Compose preferences, theme, and notifications

Place the initialization element in the document head. Keep the same namespace on the provider. A local tree needs no server adapter; use `mode: 'remote'` with complete authoritative preferences and a rejecting `persistPreferences` promise when the application saves settings remotely.

```ts
import { createElement } from 'react';
import {
  ThemeInitializationScript,
  ThemeProvider,
  ThemeToggleButton,
  Toastr,
  UiPreferencesProvider,
} from 'jg-react-ui';
const storageId = 'personal-hq';
const head = createElement(ThemeInitializationScript, { storageId, nonce: 'example-nonce' });
const app = createElement(UiPreferencesProvider, {
  mode: 'local',
  storageId,
  children: createElement(ThemeProvider, {
    children: [
      createElement(ThemeToggleButton, { key: 'theme', size: 'icon-touch' }),
      createElement(Toastr, { key: 'toasts', closeButton: true }),
    ],
  }),
});
```

Read `useUiPreferences()` for the snapshot, update function, capability, and pending state. Use `useUiPreferencesCapabilities()` when only capability or the stable update callback is needed. `useTheme()` requires a ThemeProvider and returns the selected theme, resolved light/dark theme, and setter. Changing a captured namespace requires a keyed provider remount.
