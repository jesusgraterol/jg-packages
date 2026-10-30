import { useState } from 'react';

import markUrl from 'jg-personal-ui/jg-mark.svg';
import faviconUrl from 'jg-personal-ui/jg-favicon.svg';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  IconTile,
  JgMark,
  type IButtonProps,
} from 'jg-personal-react-ui';

const VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const satisfies IButtonProps['variant'][];

const BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'warning',
  'success',
  'outline',
  'ghost',
] as const;
const TILE_TONES = ['neutral', 'brand', 'success', 'warning', 'destructive'] as const;
const TILE_SIZES = ['sm', 'md', 'lg'] as const;
const MARK_SIZES = [16, 32, 64] as const;

/** Renders real published components for private visual and browser verification. */
export const Gallery = () => {
  const [savedCount, setSavedCount] = useState(0);
  return (
    <main>
      <header>
        <JgMark className="size-12" />
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
      <section aria-labelledby="labels-title">
        <h2 id="labels-title">Labels and icon tiles</h2>
        <p>Status labels share the same palette as app actions and supporting icons.</p>
        <div
          className="actions"
          role="group"
          aria-label="Badge variants"
        >
          {BADGE_VARIANTS.map((variant) => (
            <Badge
              key={variant}
              variant={variant}
            >
              {variant}
            </Badge>
          ))}
          <Badge
            asChild
            variant="outline"
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            <a href="#alerts-title">Review notices</a>
          </Badge>
        </div>
        <div
          className="actions"
          role="group"
          aria-label="Icon tile tones"
        >
          {TILE_TONES.map((tone, index) => (
            <div
              key={tone}
              className="tile-example"
            >
              <IconTile
                tone={tone}
                aria-hidden={false}
              >
                {index + 1}
              </IconTile>
              <span>{tone}</span>
            </div>
          ))}
        </div>
        <div
          className="actions"
          role="group"
          aria-label="Icon tile sizes"
        >
          {TILE_SIZES.map((size) => (
            <IconTile
              key={size}
              size={size}
            >
              {size}
            </IconTile>
          ))}
        </div>
      </section>
      <section aria-labelledby="alerts-title">
        <h2 id="alerts-title">Notices</h2>
        <div className="callouts">
          <Alert>
            <AlertTitle>Everything is saved</AlertTitle>
            <AlertDescription>
              Your latest work is ready to pick up on your next visit, including longer notes that
              wrap naturally on a narrow screen.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Connection interrupted</AlertTitle>
            <AlertDescription>
              Your work remains here. Reconnect before syncing changes.
            </AlertDescription>
          </Alert>
          <Alert
            asChild
            interaction="redirect"
          >
            <a href="#actions-title">
              <AlertTitle>Review available actions</AlertTitle>
              <AlertDescription>Open the actions above.</AlertDescription>
            </a>
          </Alert>
          <Alert
            asChild
            interaction="action"
            onClick={() => setSavedCount((count) => count + 1)}
          >
            <button type="button">
              <AlertTitle>Try syncing again</AlertTitle>
              <AlertDescription>Run this action from the keyboard or by touch.</AlertDescription>
            </button>
          </Alert>
          <Alert>
            <AlertTitle>Sync complete</AlertTitle>
            <AlertDescription>A supplementary action remains available.</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="touch"
                onClick={() => setSavedCount(0)}
              >
                Reset
              </Button>
            </AlertAction>
          </Alert>
        </div>
      </section>
      <section aria-labelledby="artwork-title">
        <h2 id="artwork-title">Shared artwork</h2>
        <p>The React mark and standalone assets keep the same fixed JG geometry and colors.</p>
        <div
          className="actions"
          role="group"
          aria-label="Brand assets"
        >
          {MARK_SIZES.map((size) => (
            <img
              key={size}
              src={markUrl}
              width={size}
              height={size}
              alt={`JG mark at ${size}px`}
            />
          ))}
          <img
            src={faviconUrl}
            width="32"
            height="32"
            alt="JG favicon"
          />
        </div>
      </section>
      <footer>Ubuntu Sans · Shared JG tokens · React 19</footer>
    </main>
  );
};
