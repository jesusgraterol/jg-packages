# jg-personal-react-ui recipes

App-side composition with the public surface.

## Use the public entry

```ts
import { createElement } from 'react';
import { Button } from 'jg-personal-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

## Style a navigation action

Use an explicit link role when the slotted child navigates.

```ts
import { createElement } from 'react';
import { Button } from 'jg-personal-react-ui/components/button';
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
import { Alert, AlertTitle, AlertDescription, Badge, IconTile } from 'jg-personal-react-ui';
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

## Identify the app

The mark is decorative; the visible link text supplies its accessible name.

```ts
import { createElement } from 'react';
import { JgMark } from 'jg-personal-react-ui/components/jg-mark';
const home = createElement(
  'a',
  { href: '/' },
  createElement(JgMark, { className: 'size-8' }),
  'JG workspace',
);
```
