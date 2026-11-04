import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ClampedText } from './clamped-text.component.js';
import type { IClampedTextProps } from './types.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// a text long enough to wrap onto many lines in a 200px column
const LONG_TEXT = 'A criterion long enough to wrap onto many lines in a narrow column. '.repeat(6);

describe('ClampedText', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    // component tests run without the stylesheet, so the column and the font are set here
    container.style.width = '200px';
    container.style.font = '16px/20px sans-serif';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderText = (props: Omit<IClampedTextProps, 'children'>, text = LONG_TEXT): void => {
    act(() => {
      root.render(<ClampedText {...props}>{text}</ClampedText>);
    });
  };

  const getToggle = () =>
    container.querySelector<HTMLButtonElement>('[data-slot="clamped-text-toggle"]');

  test('offers Show all only when the clamp cuts the text off, and names the text it controls', () => {
    renderText({ textClassName: 'text-sm' });

    const text = container.querySelector('p') as HTMLParagraphElement;
    const toggle = getToggle() as HTMLButtonElement;
    expect(toggle.textContent).toBe('Show all');
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(text.id);
    expect(text.className).toContain('line-clamp-3');
    expect(text.className).toContain('text-sm');
    expect(toggle.className).toContain('pointer-coarse:min-h-11');

    act(() => {
      toggle.click();
    });

    expect(toggle.textContent).toBe('Show less');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(text.className).not.toContain('line-clamp-3');
  });

  test('shows a short text without a toggle or an empty row', () => {
    renderText({}, 'Short.');

    expect(getToggle()).toBeNull();
    expect(container.querySelector('[data-slot="clamped-text-details"]')).toBeNull();
  });

  test('keeps the details in the toggle row, even when nothing is cut off', () => {
    renderText({ details: <span>Done</span> }, 'Short.');

    const row = container.querySelector('[data-slot="clamped-text-details"]');
    expect(row?.textContent).toBe('Done');
    expect(getToggle()).toBeNull();
  });

  test('follows the expansion a list keeps, telling it when the reader toggles', () => {
    const handleExpandedChange = vi.fn<(isExpanded: boolean) => void>();
    const ControlledText = (): ReactElement => {
      const [isExpanded, setIsExpanded] = useState(true);
      return (
        <ClampedText
          collapseLabel="Fold"
          expandLabel="Unfold"
          id="criterion-ac-01"
          isExpanded={isExpanded}
          lines={2}
          onExpandedChange={(next) => {
            handleExpandedChange(next);
            setIsExpanded(next);
          }}
        >
          {LONG_TEXT}
        </ClampedText>
      );
    };
    act(() => {
      root.render(<ControlledText />);
    });

    // a text that opens expanded still offers to fold it
    const toggle = getToggle() as HTMLButtonElement;
    expect(toggle.textContent).toBe('Fold');
    expect(toggle.getAttribute('aria-controls')).toBe('criterion-ac-01');

    act(() => {
      toggle.click();
    });

    expect(handleExpandedChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(toggle.textContent).toBe('Unfold');
    expect(container.querySelector('p')?.className).toContain('line-clamp-2');
  });

  test('toggles from the keyboard', async () => {
    renderText({});
    const toggle = getToggle() as HTMLButtonElement;
    toggle.focus();

    await act(async () => {
      toggle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      toggle.click();
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
