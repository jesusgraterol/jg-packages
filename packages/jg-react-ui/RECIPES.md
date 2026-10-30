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

## Compose fields and choice controls

The application owns validation. Associate labels, descriptions, and errors explicitly. Keep compact checkbox, radio, and switch glyphs inside labelled rows with at least a 44px touch target.

```ts
import { createElement } from 'react';
import { Checkbox, Field, FieldDescription, Input, Label } from 'jg-react-ui/components/form';
const field = createElement(
  Field,
  null,
  createElement(Label, { htmlFor: 'workspace-name' }, 'Workspace name'),
  createElement(Input, {
    id: 'workspace-name',
    name: 'workspace',
    required: true,
    'aria-describedby': 'workspace-help',
  }),
  createElement(FieldDescription, { id: 'workspace-help' }, 'Choose a recognizable name.'),
);
const choice = createElement(
  Label,
  { htmlFor: 'keep-history', className: 'flex min-h-11 items-center gap-3' },
  createElement(Checkbox, { id: 'keep-history', defaultChecked: true }),
  'Keep session history',
);
```

## Choose tab overflow and cancel a menu command

Choose `scroll` for complete long labels, or `truncate` for constrained labels. Composite truncated labels require an authored `title` or `aria-label`. Manual activation moves focus with arrow keys and selects on Enter or Space. A menu item's cancelable `onSelect` event can keep its menu open.

```ts
import { createElement } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'jg-react-ui';
const tabs = createElement(
  Tabs,
  { defaultValue: 'overview', activationMode: 'manual' },
  createElement(
    TabsList,
    { overflowBehavior: 'scroll', 'aria-label': 'Workspace views' },
    createElement(TabsTrigger, { value: 'overview' }, 'Workspace overview'),
    createElement(TabsTrigger, { value: 'history' }, 'Recent session history'),
  ),
  createElement(TabsContent, { value: 'overview' }, 'Overview'),
  createElement(TabsContent, { value: 'history' }, 'History'),
);
const menu = createElement(
  DropdownMenu,
  null,
  createElement(DropdownMenuTrigger, null, 'Commands'),
  createElement(
    DropdownMenuContent,
    null,
    createElement(
      DropdownMenuItem,
      { onSelect: (event) => event.preventDefault() },
      'Keep menu open',
    ),
  ),
);
```

## Copy exact text and keep technical content readable

`copyLabel` describes the ready operation; `label` adds visible text. Copied feedback starts only after the native write fulfills. Cancellation is silent, and failures use the scoped error policy with manual-copy guidance. `copiedFeedbackDuration` retains Moldea's milliseconds contract. New-tab TextLinks retain secure rel tokens and an accessible destination notice.

```ts
import { createElement } from 'react';
import { CopyButton, InlineCode, TextLink, TableContainer } from 'jg-react-ui';
const copy = createElement(CopyButton, {
  value: 'pnpm build',
  copyLabel: 'Copy build command',
  label: 'Copy command',
  size: 'touch',
});
const path = createElement(InlineCode, null, '/workspace/config/preferences.ts');
const guide = createElement(
  TextLink,
  { href: 'https://example.com/guide', target: '_blank' },
  'Workspace guide',
);
const tableRegion = createElement(
  TableContainer,
  {
    role: 'region',
    'aria-label': 'Workspace settings',
    tabIndex: 0,
    className: 'outline-none focus-visible:ring-2 focus-visible:ring-foreground',
  },
  'Table content',
);
```
