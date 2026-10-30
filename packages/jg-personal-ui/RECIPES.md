# jg-personal-ui recipes

App-side composition with the initial public surface.

## Use the public entry

```ts
import { JG_PERSONAL_UI_TOKEN_NAMES } from 'jg-personal-ui';
const sharedTokens = JG_PERSONAL_UI_TOKEN_NAMES;
```

## Select syntax token names

```ts
import { JG_PERSONAL_UI_TOKEN_NAMES } from 'jg-personal-ui/tokens';
const syntaxTokens = JG_PERSONAL_UI_TOKEN_NAMES.filter((name) => name.startsWith('--jg-syntax-'));
```
