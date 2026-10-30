# jg-personal-react-ui recipes

App-side composition with the initial public surface.

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
