import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { CompactMarkdownEditor, MarkdownEditor, WideMarkdownEditor } from './index.js';

let container: HTMLDivElement;
let root: Root;
let originalClassName: string;
let originalActEnvironment: PropertyDescriptor | undefined;

beforeEach(() => {
  originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
  });
  originalClassName = document.documentElement.className;
  container = document.createElement('div');
  container.style.width = '800px';
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    document.documentElement.className = originalClassName;
    await Promise.resolve();
  });
  container.remove();
  vi.unstubAllGlobals();
  if (originalActEnvironment)
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
  else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

test('uses measured width, preserves the controlled draft through layout and theme changes', async () => {
  const onChange = vi.fn();
  await act(async () => {
    root.render(
      <MarkdownEditor
        aria-label="Notes"
        onChange={onChange}
        value="Retained draft"
      />,
    );
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(
      container.querySelector('[data-markdown-editor-layout="wide"] [role="textbox"]')?.textContent,
    ).toBe('Retained draft');
  });
  await act(async () => {
    container.style.width = '320px';
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(
      container.querySelector('[data-markdown-editor-layout="compact"] [role="textbox"]')
        ?.textContent,
    ).toBe('Retained draft');
  });
  const previousTextbox = container.querySelector('[role="textbox"]');
  await act(async () => {
    document.documentElement.classList.toggle('dark');
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    const textbox = container.querySelector('[role="textbox"]');
    expect(textbox).not.toBe(previousTextbox);
    expect(textbox?.textContent).toBe('Retained draft');
  });
  expect(onChange).not.toHaveBeenCalled();
});

test('keeps a hidden auto editor pending until its container becomes measurable', async () => {
  container.style.display = 'none';
  await act(async () => {
    root.render(
      <MarkdownEditor
        onChange={vi.fn()}
        value="Hidden draft"
      />,
    );
    await Promise.resolve();
  });
  expect(container.querySelector('[data-markdown-editor-layout="pending"]')).not.toBeNull();
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('true');
  expect(container.querySelector('[role="textbox"]')).toBeNull();
  await act(async () => {
    container.style.display = '';
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(container.querySelector('[role="textbox"]')?.textContent).toBe('Hidden draft');
  });
});

test.each([CompactMarkdownEditor, WideMarkdownEditor])(
  'the explicit %s variant retains readonly semantics',
  async (Component) => {
    await act(async () => {
      root.render(
        <Component
          aria-label="Readonly notes"
          disabled
          onChange={vi.fn()}
          value="Saved notes"
        />,
      );
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      const textbox = container.querySelector('[role="textbox"]');
      expect(textbox?.getAttribute('aria-label')).toBe('Readonly notes');
      expect(textbox?.getAttribute('aria-readonly')).toBe('true');
      expect(textbox?.getAttribute('contenteditable')).toBe('false');
      expect(textbox?.textContent).toBe('Saved notes');
    });
  },
);

test('auto layout uses its initial measured width when ResizeObserver is unavailable', async () => {
  vi.stubGlobal('ResizeObserver', undefined);
  container.style.width = '320px';
  await act(async () => {
    root.render(
      <MarkdownEditor
        onChange={vi.fn()}
        value="Measured draft"
      />,
    );
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(
      container.querySelector('[data-markdown-editor-layout="compact"] [role="textbox"]')
        ?.textContent,
    ).toBe('Measured draft');
  });
});

test.each(['wide', 'compact'] as const)(
  'the %s facade override takes precedence over container width',
  async (layout) => {
    container.style.width = layout === 'wide' ? '320px' : '800px';
    await act(async () => {
      root.render(
        <MarkdownEditor
          layout={layout}
          onChange={vi.fn()}
          value="Fixed layout draft"
        />,
      );
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(
        container.querySelector(`[data-markdown-editor-layout="${layout}"] [role="textbox"]`)
          ?.textContent,
      ).toBe('Fixed layout draft'),
    );
  },
);
