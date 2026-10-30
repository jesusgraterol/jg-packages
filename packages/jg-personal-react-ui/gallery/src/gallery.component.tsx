import { useState } from 'react';

import { Button, type IButtonProps } from 'jg-personal-react-ui';

const VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const satisfies IButtonProps['variant'][];

/** Renders real published components for private visual and browser verification. */
export const Gallery = () => {
  const [savedCount, setSavedCount] = useState(0);
  return (
    <main>
      <header>
        <p className="eyebrow">JG / PERSONAL UI</p>
        <h1>
          Shared components.
          <br />
          Personal by design.
        </h1>
        <p className="intro">
          Moldea’s component APIs, with the typography and palette shared by JG interfaces.
        </p>
      </header>
      <section aria-labelledby="actions-title">
        <h2 id="actions-title">Actions</h2>
        <p>One implementation, ready for native buttons and linked actions.</p>
        <div className="actions">
          {VARIANTS.map((variant) => (
            <Button
              key={variant}
              variant={variant}
              size="touch"
              onClick={() => setSavedCount((count) => count + 1)}
            >
              {variant}
            </Button>
          ))}
        </div>
        <p role="status">Actions completed: {savedCount}</p>
      </section>
      <section aria-labelledby="states-title">
        <h2 id="states-title">States and badges</h2>
        <div className="actions">
          <Button
            size="touch"
            badgeCount={12}
          >
            Inbox
          </Button>
          <Button
            size="touch"
            disabled
          >
            Unavailable
          </Button>
          <Button
            size="touch"
            aria-busy="true"
          >
            Saving changes
          </Button>
          <Button
            size="icon-touch"
            aria-label="Add item"
          >
            +
          </Button>
          <Button
            asChild
            size="touch"
            variant="link"
          >
            <a
              href="#actions-title"
              role="link"
            >
              Review actions
            </a>
          </Button>
        </div>
      </section>
      <footer>Ubuntu Sans · Shared JG tokens · React 19</footer>
    </main>
  );
};
