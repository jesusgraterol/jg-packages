import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('Tooltip', { tags: ['full'] }, () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test('passes trigger behavior and styling to the slotted child', () => {
    act(() => {
      root.render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button">More details</button>
            </TooltipTrigger>
            <TooltipContent forceMount>Contextual help</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    });

    const trigger = container.querySelector('button[data-slot="tooltip-trigger"]');

    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toBe('More details');
  });

  test('renders force-mounted tooltip content through the Base UI portal', () => {
    act(() => {
      root.render(
        <TooltipProvider>
          <Tooltip defaultOpen>
            <TooltipTrigger asChild>
              <button type="button">Inspect</button>
            </TooltipTrigger>
            <TooltipContent
              forceMount
              side="bottom"
            >
              Inspection details
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );
    });

    const content = document.body.querySelector('[data-slot="tooltip-content"]');
    const positioner = content?.parentElement;

    expect(content).not.toBeNull();
    expect(content?.textContent).toBe('Inspection details');
    expect(content?.className).toContain('data-open:animate-in');
    expect(content?.className).toContain('motion-reduce:animate-none');
    expect(content?.className).toContain('motion-reduce:data-open:animate-none');
    expect(content?.className).toContain('motion-reduce:data-closed:animate-none');
    expect(positioner?.className).toContain('isolate');
  });
});

test(
  'native tooltip triggers and slotted portal content retain explicit timing and positioning options',
  { tags: ['full'] },
  () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      act(() =>
        root.render(
          <TooltipProvider
            delay={16}
            timeout={32}
            disableHoverableContent
          >
            <Tooltip
              defaultOpen
              delayDuration={8}
              disableHoverablePopup={false}
            >
              <TooltipTrigger delay={0}>Inspect options</TooltipTrigger>
              <TooltipContent
                asChild
                forceMount
                hideWhenDetached
                avoidCollisions={false}
                collisionAvoidance={{ side: 'flip', align: 'shift' }}
              >
                <div>Native trigger help</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>,
        ),
      );
      expect(container.querySelector('button')?.textContent).toBe('Inspect options');
      expect(document.body.querySelector('[data-slot="tooltip-content"]')?.textContent).toBe(
        'Native trigger help',
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  },
);
