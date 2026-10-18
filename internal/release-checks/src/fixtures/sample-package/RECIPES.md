# jg-release-checks-sample recipes

Patterns for apps that greet their visitors.

## Greeting a visitor

Greet whoever signed in, and fall back to the default name for a guest:

```ts
import { DEFAULT_NAME, greet } from 'jg-release-checks-sample';

declare const visitor: { name?: string | undefined };

const greeting = greet(visitor.name ?? DEFAULT_NAME);
```
