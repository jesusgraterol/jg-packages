import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { page } from 'vitest/browser';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';

import { ThemeProvider } from '../theme-provider/index.js';
import {
  UiPreferencesProvider,
  useUiPreferencesCapabilities,
} from '../ui-preferences-provider/index.js';
import { CodeDiffSyntaxHighlighter } from './code-highlighting.js';
import { CodeDiff, type ICodeDiffProps } from './index.js';

// observe actual Prism work without replacing the highlighter.
vi.mock('react-syntax-highlighter', { spy: true });

let hydrationRoot: Root | undefined;
let hydrationContainer: HTMLDivElement | undefined;
let originalClassName: string;
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let originalActEnvironment: boolean | undefined;

beforeEach(async () => {
  originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  originalClassName = document.documentElement.className;
  localStorage.removeItem('jg-ui-preferences');
  await page.viewport(1280, 800);
});
afterEach(() => {
  cleanup();
  if (hydrationRoot) act(() => hydrationRoot?.unmount());
  hydrationRoot = undefined;
  hydrationContainer?.remove();
  hydrationContainer = undefined;
  document.documentElement.className = originalClassName;
  localStorage.removeItem('jg-ui-preferences');
  vi.restoreAllMocks();
  if (originalActEnvironment === undefined)
    Reflect.deleteProperty(actEnvironment, 'IS_REACT_ACT_ENVIRONMENT');
  else actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});

const DiffSurface = ({
  mode = 'local',
  theme = 'light',
  ...props
}: ICodeDiffProps & { mode?: 'local' | 'read-only'; theme?: 'light' | 'dark' }) => (
  <UiPreferencesProvider
    mode={mode}
    initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme }}
  >
    <ThemeProvider>
      <CodeDiff {...props} />
    </ThemeProvider>
  </UiPreferencesProvider>
);

test.each(['unified', 'split'] as const)(
  'real %s viewer highlights only changed words and preserves indentation',
  async (codeDiffView) => {
    const oldValue = '  `Draft the campaign in ${recipientLanguage}.`;';
    const newValue = "  'Draft the campaign in English.';";
    const { container } = render(
      <DiffSurface
        oldValue={oldValue}
        newValue={newValue}
        language="typescript"
        codeDiffView={codeDiffView}
        showDiffOnly={false}
      />,
    );
    await expect
      .poll(() =>
        container.querySelector('[data-slot="code-diff"]')?.getAttribute('data-code-diff-view'),
      )
      .toBe(codeDiffView);
    const deletions = [...container.querySelectorAll('del')];
    const insertions = [...container.querySelectorAll('ins')];
    expect(deletions.map((element) => element.textContent)).toStrictEqual([
      '`',
      '${recipientLanguage}',
      '`',
    ]);
    expect(insertions.map((element) => element.textContent)).toStrictEqual(["'", 'English', "'"]);
    expect(deletions[0]?.closest('td')?.textContent).toBe(oldValue);
    expect(insertions[0]?.closest('td')?.textContent).toBe(newValue);
    expect(container.textContent).not.toContain('Computing code diff');
    const table = container.querySelector('table');
    expect(table && getComputedStyle(table).tableLayout).toBe('fixed');
    expect(deletions[0] && getComputedStyle(deletions[0]).whiteSpace).toBe('pre-wrap');
  },
);

test('server output is complete and hydrates without recovering or dropping changed tokens', async () => {
  const element = (
    <DiffSurface
      oldValue="const count = 14;"
      newValue="const count = 30;"
      language="typescript"
    />
  );
  const server = renderToString(element);
  expect(server).toContain('<del');
  expect(server).toContain('<ins');
  expect(server).not.toContain('Computing code diff');
  hydrationContainer = document.createElement('div');
  hydrationContainer.innerHTML = server;
  document.body.appendChild(hydrationContainer);
  const errors: unknown[] = [];
  await act(async () => {
    hydrationRoot = hydrateRoot(hydrationContainer!, element, {
      onRecoverableError: (error) => errors.push(error),
    });
    await Promise.resolve();
  });
  expect(errors).toStrictEqual([]);
  expect(hydrationContainer.querySelector('del')?.textContent).toBe('14');
  expect(hydrationContainer.querySelector('ins')?.textContent).toBe('30');
});

test('small revision changes render synchronously with no stale rows or loading frame', () => {
  const { container, rerender } = render(
    <DiffSurface
      oldValue="status = queued"
      newValue="status = approved"
    />,
  );
  expect(container.querySelector('ins')?.textContent).toBe('approved');
  rerender(
    <DiffSurface
      oldValue="status = queued"
      newValue="status = rejected"
    />,
  );
  expect(container.querySelector('ins')?.textContent).toBe('rejected');
  expect(container.textContent).not.toContain('approved');
  expect(container.textContent).not.toContain('Computing code diff');
});

test.each(['unified', 'split'] as const)(
  '%s folded sections have one native keyboard control each',
  async (codeDiffView) => {
    const prefix = Array.from({ length: 8 }, (_, index) => `prefix ${index}`).join('\n');
    const suffix = Array.from({ length: 8 }, (_, index) => `suffix ${index}`).join('\n');
    const { container } = render(
      <DiffSurface
        oldValue={`${prefix}\nold line\n${suffix}`}
        newValue={`${prefix}\nnew line\n${suffix}`}
        codeDiffView={codeDiffView}
        extraLinesSurroundingDiff={0}
      />,
    );
    const fold = page.getByRole('button', { name: /Show \d+ unchanged lines/ });
    await expect.element(fold).toHaveLength(2);
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('tbody button')];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      const row = button.closest('tr');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.tabIndex).toBe(0);
      expect(row?.getAttribute('role')).toBeNull();
      expect(row?.getAttribute('tabindex')).toBeNull();
      expect(row?.querySelectorAll('button')).toHaveLength(1);
      expect(row && getComputedStyle(row).cursor).toBe('default');
      expect(getComputedStyle(button).cursor).toBe('pointer');
    }
    await act(async () => {
      await fold.first().click();
    });
    expect(container.textContent).toContain('prefix 0');
    await act(async () => {
      await fold.first().click();
    });
    expect(container.textContent).toContain('suffix 7');
  },
);

test('large comparisons run in a real worker and terminate it after rendering', async () => {
  const post = vi.spyOn(Worker.prototype, 'postMessage');
  const terminate = vi.spyOn(Worker.prototype, 'terminate');
  const prefix = Array.from(
    { length: 256 },
    (_, index) => `line ${index}: ${'content '.repeat(8)}`,
  ).join('\n');
  const oldValue = `${prefix}\nold tail`;
  const newValue = `${prefix}\nnew tail`;
  const { container } = render(
    <DiffSurface
      oldValue={oldValue}
      newValue={newValue}
    />,
  );
  await expect
    .poll(async () => {
      await act(async () => {
        await Promise.resolve();
      });
      return container.querySelector('ins')?.textContent;
    })
    .toBe('new');
  expect(post).toHaveBeenCalledWith(
    expect.objectContaining({ oldString: oldValue, newString: newValue }),
  );
  expect(terminate).toHaveBeenCalled();
});

test('explicit synchronous large input and caller props retain their upstream behavior', () => {
  const source = 'x'.repeat(8192);
  const onLineNumberClick = vi.fn();
  const { container } = render(
    <DiffSurface
      oldValue={`${source}\nold`}
      newValue={`${source}\nnew`}
      disableWorker
      showDiffOnly={false}
      linesOffset={20}
      leftTitle="Before"
      rightTitle="After"
      summary="Review changes"
      codeDiffView="split"
      onLineNumberClick={onLineNumberClick}
      tabIndex={0}
      styles={{ contentText: { fontSize: 16 } }}
    />,
  );
  expect(container.textContent).toContain('Review changes');
  expect(container.textContent).toContain('Before');
  expect(container.textContent).toContain('After');
  expect(container.textContent).not.toContain('Computing code diff');
  expect(container.querySelector('[data-slot="code-diff-content"]')?.getAttribute('tabindex')).toBe(
    '0',
  );
  expect(
    container.querySelector('pre') && getComputedStyle(container.querySelector('pre')!).fontSize,
  ).toBe('16px');
});

test('file metadata and editable preferences retain one view control and no wrapping control', async () => {
  const { container } = render(
    <DiffSurface
      oldValue="before"
      newValue="after"
      filePath="src/agent.ts"
      fileStatus="modified"
      headerMeta="Pending review"
    />,
  );
  await expect.element(page.getByRole('button', { name: 'Code diff view: Split' })).toBeVisible();
  expect(container.textContent).toContain('agent.ts');
  expect(container.textContent).toContain('Pending review');
  expect(container.querySelectorAll('[data-slot="code-diff-header"]')).toHaveLength(1);
  expect(container.querySelector('[aria-label^="Line wrapping:"]')).toBeNull();
  await act(async () => {
    await page.getByRole('button', { name: 'Code diff view: Split' }).click();
  });
  await act(async () => {
    await page.getByRole('menuitemcheckbox', { name: 'Unified', exact: true }).click();
  });
  expect(
    container.querySelector('[data-slot="code-diff"]')?.getAttribute('data-code-diff-view'),
  ).toBe('unified');
});

test('phone layout forces unified and explicit or read-only policies hide mutation controls', async () => {
  await page.viewport(320, 640);
  const { container, rerender } = render(
    <DiffSurface
      oldValue="before"
      newValue="after"
      codeDiffView="split"
    />,
  );
  expect(
    container.querySelector('[data-slot="code-diff"]')?.getAttribute('data-code-diff-view'),
  ).toBe('unified');
  expect(container.querySelector('[aria-label^="Code diff view:"]')).toBeNull();
  await page.viewport(1280, 800);
  rerender(
    <DiffSurface
      oldValue="before"
      newValue="after"
      codeDiffView="unified"
    />,
  );
  expect(container.querySelector('[aria-label^="Code diff view:"]')).toBeNull();
  rerender(
    <DiffSurface
      oldValue="before"
      newValue="after"
      mode="read-only"
    />,
  );
  expect(container.querySelector('[aria-label^="Code diff view:"]')).toBeNull();
});

test(
  'a read-only dark diff preserves singular folds and stationary header metadata',
  { tags: ['full'] },
  () => {
    const { container } = render(
      <DiffSurface
        oldValue={'one unchanged line\nold\nlast'}
        newValue={'one unchanged line\nnew\nlast'}
        extraLinesSurroundingDiff={0}
        disableWordDiff
        headerLabel="Agent changes"
        mode="read-only"
        theme="dark"
      />,
    );
    expect(container.textContent).toContain('Show 1 unchanged line');
    expect(container.textContent).toContain('Agent changes');
    expect(container.querySelector('[aria-label^="Code diff view:"]')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  },
);

test('visible blank lines keep a rendered line box when word comparison is disabled', () => {
  const { container } = render(
    <DiffSurface
      oldValue={'one\n\nold'}
      newValue={'one\n\nnew'}
      showDiffOnly={false}
      disableWordDiff
    />,
  );
  const rows = [...container.querySelectorAll('tbody tr')];
  const blankRow = rows.find((row) => row.textContent?.replace(/\s/g, '') === '22');
  expect(blankRow).toBeDefined();
  expect(blankRow?.getBoundingClientRect().height).toBeGreaterThan(0);
});

test('unrelated remote preference saves do not repeat diff syntax highlighting', async () => {
  let finishSave: (() => void) | undefined;
  const persistPreferences = () =>
    new Promise<void>((resolve) => {
      finishSave = resolve;
    });
  const PreferenceAction = () => {
    const { updatePreferences } = useUiPreferencesCapabilities();
    return (
      <button
        onClick={() =>
          updatePreferences({ appInstallToastrDismissedAt: '2026-10-31T00:00:00.000Z' })
        }
      >
        Save another preference
      </button>
    );
  };
  const renderSyntax = vi.mocked(CodeDiffSyntaxHighlighter);
  try {
    render(
      <UiPreferencesProvider
        mode="remote"
        initialPreferences={DEFAULT_UI_PREFERENCES}
        persistPreferences={persistPreferences}
      >
        <ThemeProvider>
          <PreferenceAction />
          <CodeDiff
            oldValue={'const unchanged = true;\nconst count = 1;'}
            newValue={'const unchanged = true;\nconst count = 2;'}
            showDiffOnly={false}
            language="typescript"
          />
        </ThemeProvider>
      </UiPreferencesProvider>,
    );
    const initialRenders = renderSyntax.mock.calls.length;
    expect(initialRenders).toBeGreaterThan(0);
    await act(async () => {
      await page.getByRole('button', { name: 'Save another preference' }).click();
    });
    expect(renderSyntax).toHaveBeenCalledTimes(initialRenders);
    await act(async () => {
      finishSave?.();
      await Promise.resolve();
    });
    expect(renderSyntax).toHaveBeenCalledTimes(initialRenders);
  } finally {
    finishSave?.();
    renderSyntax.mockClear();
  }
});

test('large revisions retain only the current computed diff', async () => {
  const post = vi.spyOn(Worker.prototype, 'postMessage');
  const prefix = 'unchanged context\n'.repeat(128);
  const oldValue = `${prefix}old tail`;
  const first = `${prefix}first tail`;
  const second = `${prefix}second tail`;
  const { container, rerender } = render(
    <DiffSurface
      oldValue={oldValue}
      newValue={first}
    />,
  );
  const waitForWord = async (word: string) => {
    await expect
      .poll(async () => {
        await act(async () => {
          await Promise.resolve();
        });
        return container.querySelector('ins')?.textContent;
      })
      .toBe(word);
  };
  await waitForWord('first');
  rerender(
    <DiffSurface
      oldValue={oldValue}
      newValue={second}
    />,
  );
  await waitForWord('second');
  rerender(
    <DiffSurface
      oldValue={oldValue}
      newValue={first}
    />,
  );
  await waitForWord('first');
  expect(post).toHaveBeenCalledTimes(3);
});

test('an obsolete worker reply cannot dismiss the current revision loading state', async () => {
  const nativePost = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage')
    ?.value as Worker['postMessage'];
  const nativeTerminate = Object.getOwnPropertyDescriptor(Worker.prototype, 'terminate')
    ?.value as Worker['terminate'];
  const workers = new Set<Worker>();
  const replies = new Map<string, () => void>();
  // compute in real workers, controlling only when their completed messages reach the viewer.
  vi.spyOn(Worker.prototype, 'postMessage').mockImplementation(function (
    this: Worker,
    message: { newString: string },
    options?: StructuredSerializeOptions,
  ) {
    workers.add(this);
    const handler = this.onmessage;
    this.onmessage = (event) => {
      replies.set(message.newString, () => {
        handler?.call(this, event);
      });
    };
    Reflect.apply(nativePost, this, [message, options]);
  });
  const prefix = 'unchanged context\n'.repeat(128);
  const first = `${prefix}first tail`;
  const second = `${prefix}second tail`;
  try {
    const { container, rerender } = render(
      <DiffSurface
        oldValue={`${prefix}old tail`}
        newValue={first}
      />,
    );
    await expect.poll(() => replies.has(first)).toBe(true);
    rerender(
      <DiffSurface
        oldValue={`${prefix}old tail`}
        newValue={second}
      />,
    );
    await expect.poll(() => replies.has(second)).toBe(true);
    await act(async () => {
      replies.get(first)?.();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Computing code diff',
    );
    await act(async () => {
      replies.get(second)?.();
      await Promise.resolve();
    });
    expect(container.querySelector('ins')?.textContent).toBe('second');
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally {
    for (const worker of workers) nativeTerminate.call(worker);
  }
});

test('large diffs recompute when controlled folding inputs change', async () => {
  const post = vi.spyOn(Worker.prototype, 'postMessage');
  const prefix = Array.from({ length: 128 }, (_, index) => `context ${index}`).join('\n');
  const oldValue = `${prefix}\nold tail`;
  const newValue = `${prefix}\nnew tail`;
  const { container, rerender } = render(
    <DiffSurface
      oldValue={oldValue}
      newValue={newValue}
      extraLinesSurroundingDiff={0}
    />,
  );
  const waitForResult = async () => {
    await expect
      .poll(async () => {
        await act(async () => {
          await Promise.resolve();
        });
        return container.querySelector('ins')?.textContent;
      })
      .toBe('new');
  };
  await waitForResult();
  rerender(
    <DiffSurface
      oldValue={oldValue}
      newValue={newValue}
      extraLinesSurroundingDiff={2}
    />,
  );
  await expect.poll(() => post.mock.calls.length).toBe(2);
  await waitForResult();
  expect(container.textContent).toContain('context 127');
  rerender(
    <DiffSurface
      oldValue={oldValue}
      newValue={newValue}
      extraLinesSurroundingDiff={2}
      alwaysShowLines={['L-1']}
    />,
  );
  await expect.poll(() => post.mock.calls.length).toBe(3);
  await waitForResult();
  expect(container.textContent).toContain('context 0');
});
