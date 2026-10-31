import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DEFAULT_UI_PREFERENCES, UI_PREFERENCES_STORAGE_KEY } from '../../contracts/index.js';

import { useUiPreferencesStoreApi } from '../../shared/ui-preferences/index.js';
import {
  UiPreferencesProvider,
  useUiPreferencesCapabilities,
} from '../ui-preferences-provider/index.js';
import { CodeBlockSyntaxHighlighter } from './code-highlighting.js';
import { CodeBlock, CodeFileHeader, type ICodeBlockProps } from './index.js';

let preferencesStore: ReturnType<typeof useUiPreferencesStoreApi>;
const PreferencesProbe = () => {
  preferencesStore = useUiPreferencesStoreApi();
  return null;
};

// observe real syntax work while preserving the dependency's rendering implementation.
vi.mock('react-syntax-highlighter', { spy: true });

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

describe('CodeBlock presentation policies', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalDocumentClassName: string;
  let originalClipboard: PropertyDescriptor | undefined;
  const writeText = vi.fn<(source: string) => Promise<void>>();

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    originalDocumentClassName = document.documentElement.className;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    writeText.mockResolvedValue(undefined);
    localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
      document.documentElement.className = originalDocumentClassName;
    });
    container.remove();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY);
    vi.clearAllMocks();
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  const render = async (props: Omit<ICodeBlockProps, 'children'>, prefersWrappedCode = false) => {
    await act(async () => {
      root.render(
        <UiPreferencesProvider
          mode="local"
          initialPreferences={{ ...DEFAULT_UI_PREFERENCES, prefersWrappedCode }}
        >
          <PreferencesProbe />
          <CodeBlock {...props}>{'<script>literal source</script>\r\nnext line\n'}</CodeBlock>
        </UiPreferencesProvider>,
      );
      await Promise.resolve();
    });
  };

  test.each([true, false])(
    'prose wraps with highlighting %s while an explicit override still wins',
    { tags: ['full'] },
    async (hasSyntaxHighlighting) => {
      await render({ language: 'markdown', hasSyntaxHighlighting });
      expect(container.querySelector('pre')?.tabIndex).toBe(-1);
      expect(container.querySelector('[aria-label^="Line wrapping:"]')).toBeNull();
      await render({ language: 'markdown', hasSyntaxHighlighting, prefersWrappedCode: false });
      expect(container.querySelector('pre')?.tabIndex).toBe(0);
      expect(container.querySelector('[aria-label^="Line wrapping:"]')).toBeNull();
    },
  );

  test(
    'unknown and unlabelled source retain the saved policy and editable wrapping control',
    { tags: ['full'] },
    async () => {
      await render({ filePath: 'src/example.unknown' });
      expect(container.querySelector('pre')?.tabIndex).toBe(0);
      expect(container.querySelector('[aria-label="Line wrapping: Scroll"]')).not.toBeNull();
      act(() =>
        preferencesStore
          .getState()
          .setUiPreferences({ ...DEFAULT_UI_PREFERENCES, prefersWrappedCode: true }),
      );
      expect(container.querySelector('pre')?.tabIndex).toBe(-1);
      expect(container.querySelector('[aria-label="Line wrapping: Wrap"]')).not.toBeNull();
      await render({});
      expect(container.querySelector('[aria-label^="Line wrapping:"]')).not.toBeNull();
    },
  );

  const verifyPlainSource = async (isDark: boolean): Promise<void> => {
    const originalTheme = document.documentElement.className;
    document.documentElement.className = isDark ? 'dark' : 'light';
    try {
      await render({
        filePath: 'src/example.ts',
        language: 'typescript',
        hasSyntaxHighlighting: false,
        tabIndex: 2,
      });
      const pre = container.querySelector('pre');
      expect(pre?.tabIndex).toBe(2);
      expect(pre?.querySelector('code')?.textContent).toBe(
        '<script>literal source</script>\r\nnext line\n',
      );
      expect(pre?.querySelector('script')).toBeNull();
      expect(pre?.querySelector('span')).toBeNull();
      expect(container.querySelector('[title="src/example.ts"]')).not.toBeNull();
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Copy to Clipboard"]')?.click();
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith('<script>literal source</script>\r\nnext line\n');
    } finally {
      // the mounted block observes the theme class, so its restore must settle inside act
      await act(async () => {
        document.documentElement.className = originalTheme;

        await Promise.resolve();
      });
    }
  };

  test.each([false] as const)(
    'plain mode preserves literal source, copy and focus in dark mode %s',
    verifyPlainSource,
  );

  test.each([true] as const)(
    'plain mode preserves literal source, copy and focus in dark mode %s',
    { tags: ['full'] },
    verifyPlainSource,
  );

  test(
    'the primary wrapping override takes precedence over the alias',
    { tags: ['full'] },
    async () => {
      await render({ language: 'text', prefersWrappedCode: false, shouldWrapContent: true });
      expect(container.querySelector('pre')?.tabIndex).toBe(0);
      await render({ language: 'typescript', shouldWrapContent: true });
      expect(container.querySelector('pre')?.tabIndex).toBe(-1);
      expect(container.querySelector('[aria-label^="Line wrapping:"]')).toBeNull();
    },
  );

  test.each([
    ['Copy full document', true],
    ['Copy loaded source', false],
  ] as const)(
    '%s copies undisplayed source with highlighting %s and announces fulfillment',
    async (copyLabel, hasSyntaxHighlighting) => {
      const source = 'complete source\r\nincluding an undisplayed final line\n';
      await render({ copyValue: source, copyLabel, hasSyntaxHighlighting });
      expect(container.querySelector('pre code')?.textContent).toBe(
        '<script>literal source</script>\r\nnext line\n',
      );
      expect(container.textContent).not.toContain('undisplayed final line');
      expect(container.querySelector('[copyvalue], [copylabel]')).toBeNull();
      const button = container.querySelector<HTMLButtonElement>(`[aria-label="${copyLabel}"]`);
      expect(button).not.toBeNull();
      expect(button?.title).toBe(copyLabel);
      expect(container.querySelector('[role="status"]')?.textContent).toBe('');

      await act(async () => {
        button?.click();
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
      expect(button?.getAttribute('aria-label')).toBe('Copied to Clipboard');
      expect(button?.title).toBe('Copied to Clipboard');
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied to Clipboard');
    },
  );

  test('an explicitly empty copy override does not fall back to rendered source', async () => {
    await render({ copyValue: '', copyLabel: 'Copy full document' });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Copy full document"]')?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledExactlyOnceWith('');
    expect(container.querySelector('pre code')?.textContent).not.toBe('');
  });

  test('failed scoped writes never produce copied naming or a success announcement', async () => {
    writeText.mockRejectedValueOnce(new Error('Permission denied'));
    await render({ copyValue: 'complete source', copyLabel: 'Copy loaded source' });
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Copy loaded source"]');
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledExactlyOnceWith('complete source');
    expect(button?.getAttribute('aria-label')).toBe('Copy loaded source');
    expect(button?.title).toBe('Copy loaded source');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  });

  test.each([{ hasHeader: false }, { hasCopyButton: false }])(
    'copy overrides do not restore hidden controls (%o)',
    async (visibility) => {
      await render({
        ...visibility,
        copyValue: 'complete source',
        copyLabel: 'Copy full document',
      });
      expect(container.querySelector('[aria-label="Copy full document"]')).toBeNull();
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(writeText).not.toHaveBeenCalled();
    },
  );
  test(
    'renders the language in an always-visible code block header when no path is provided',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(<CodeBlock language="typescript">const isReady = true;</CodeBlock>);
      });

      const header = container.querySelector<HTMLElement>('[data-slot="code-block-header"]');
      const language = header?.querySelector('[data-slot="code-block-language"]');

      expect(header).not.toBeNull();
      expect(language?.textContent).toBe('TypeScript');
      expect(header?.querySelector('[data-slot="code-block-file-path"]')).toBeNull();
      expect(header?.querySelector('button[aria-label="Copy to Clipboard"]')).not.toBeNull();
      expect(container.querySelector<HTMLPreElement>('pre')?.style.background).toBe(
        'var(--background)',
      );
    },
  );

  test(
    'reconciles server-rendered source colors with a dark document during hydration',
    { tags: ['full'] },
    async () => {
      act(() => root.unmount());
      document.documentElement.className = 'dark';
      const source = (
        <CodeBlock
          language="typescript"
          hasCopyButton={false}
          hasPreferencesControls={false}
        >
          {"const outcome = 'approved';"}
        </CodeBlock>
      );
      container.innerHTML = renderToString(source);
      const token = (): HTMLElement | undefined =>
        [...container.querySelectorAll<HTMLElement>('pre span')].find(
          (span) => span.textContent === "'approved'",
        );
      expect(token()?.style.color).toBe('var(--syntax-token-string, #2f6f31)');
      await act(async () => {
        root = hydrateRoot(container, source);

        await Promise.resolve();
      });
      expect(token()?.style.color).toBe('var(--syntax-token-string, #98c379)');
      await act(async () => {
        document.documentElement.className = 'light';

        await Promise.resolve();
      });
      expect(token()?.style.color).toBe('var(--syntax-token-string, #2f6f31)');
    },
  );

  test('renders Plain text when the code block language is omitted', { tags: ['full'] }, () => {
    act(() => {
      root.render(<CodeBlock>Application output</CodeBlock>);
    });

    expect(container.querySelector('[data-slot="code-block-language"]')?.textContent).toBe(
      'Plain text',
    );
  });

  test.each([
    'src/services/example.service.ts',
    'src/services/' + 'very-long-filename-'.repeat(8) + '.ts',
  ])(
    'keeps the complete accessible file path %s instead of a language label',
    { tags: ['full'] },
    (path) => {
      act(() => {
        root.render(
          <CodeBlock
            filePath={path}
            language="typescript"
          >
            const isReady = true;
          </CodeBlock>,
        );
      });

      const filePath = container.querySelector('[data-slot="code-block-file-path"]');

      expect(filePath?.textContent).toBe(path);
      expect(filePath?.getAttribute('title')).toBe(path);
      expect(container.querySelector('[data-slot="code-block-language"]')).toBeNull();
    },
  );

  test(
    'displays a root-relative repository path without its leading slash',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <CodeBlock
            filePath="/moldea/project.md"
            language="markdown"
          >
            {'# Project'}
          </CodeBlock>,
        );
      });

      const filePath = container.querySelector('[data-slot="code-block-file-path"]');

      expect(filePath?.textContent).toBe('moldea/project.md');
      expect(filePath?.getAttribute('title')).toBe('moldea/project.md');
    },
  );

  test('supports an authored file header and hides optional controls', { tags: ['full'] }, () => {
    act(() =>
      root.render(
        <CodeBlock
          filePath="src/agent.ts"
          fileStatus="modified"
          headerLabel={<code>agent.ts</code>}
          headerRole="Agent implementation"
          headerMeta="Candidate commit"
          hasCopyButton={false}
          hasPreferencesControls={false}
        >
          {'const ready = true;'}
        </CodeBlock>,
      ),
    );
    expect(container.querySelector('[data-slot="code-block-header"]')?.textContent).toBe(
      'Agent implementationagent.tsCandidate commitM',
    );
    expect(container.querySelector('[data-slot="code-file-role"]')?.textContent).toBe(
      'Agent implementation',
    );
    expect(container.querySelector('[data-slot="code-block-file-path"]')?.textContent).toBe(
      'agent.ts',
    );
    expect(container.querySelector('[aria-label="Modified"]')?.textContent).toBe('M');
    expect(container.querySelector('[data-slot="code-block-actions"]')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('const ready = true;');
  });

  test('renders only source when the header is disabled', { tags: ['full'] }, () => {
    act(() =>
      root.render(<CodeBlock hasHeader={false}>{'copy from the dialog action'}</CodeBlock>),
    );
    expect(container.querySelector('[data-slot="code-block-header"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe('copy from the dialog action');
  });

  test('copies the exact code block text from the header action', async () => {
    const source = "const isReady = true;\n  console.log('ready');";

    await act(async () => {
      root.render(<CodeBlock language="typescript">{source}</CodeBlock>);

      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy to Clipboard"]')?.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(source);
  });

  test.each([
    ['javascript', 'const count = 7;', 'const'],
    ['js', 'const count = 7;', 'const'],
    ['css', 'body { color: red; }', 'color'],
    ['scss', '$accent: red; body { color: $accent; }', '$accent'],
    ['html', '<button>Save</button>', 'button'],
    ['xml', '<setting>enabled</setting>', 'setting'],
    ['svg', '<svg><path /></svg>', 'svg'],
    ['sql', 'SELECT app_user.id FROM app_user;', 'SELECT'],
    ['jsonc', '{\n// Configuration\n"enabled": true\n}', '// Configuration'],
    ['json5', '{enabled: true}', 'true'],
    ['graphql', 'query Project { project { id } }', 'query'],
    ['dockerfile', 'FROM node:24-alpine', 'FROM'],
    ['toml', '[project]\nenabled = true', 'true'],
    ['ini', '[project]\nenabled=true', 'enabled'],
    ['sh', 'echo "Ready"', '"Ready"'],
    ['dotenv', 'NODE_ENV="development"', '"development"'],
    ['env', 'NODE_ENV="development"', '"development"'],
    ['yml', 'enabled: true', 'true'],
  ])(
    'CodeBlock(%s) highlights its registered language or alias',
    { tags: ['full'] },
    (language, source, tokenText) => {
      act(() => {
        root.render(<CodeBlock language={language}>{source}</CodeBlock>);
      });

      expect(container.querySelector('pre code')?.textContent).toBe(source);
      expect(
        Array.from(container.querySelectorAll<HTMLSpanElement>('pre span')).some(
          (span) => span.textContent === tokenText && span.style.color !== '',
        ),
      ).toBe(true);
    },
  );

  test('distinguishes diff changes while keeping patch headers and context neutral', () => {
    const source = [
      '--- a/settings.ts',
      '+++ b/settings.ts',
      '@@ -1,3 +1,3 @@',
      ' const settings = {',
      '-\tretentionDays: 30,',
      '+\tretentionDays: 7,',
      ' };',
      '',
    ].join('\n');

    act(() => {
      root.render(<CodeBlock language="diff">{source}</CodeBlock>);
    });

    const code = container.querySelector<HTMLElement>('pre code');

    expect(code?.textContent).toBe(source);
    expect(code?.querySelector('[data-change="removed"]')?.textContent).toBe(
      '-\tretentionDays: 30,\n',
    );
    expect(code?.querySelector('[data-change="added"]')?.textContent).toBe(
      '+\tretentionDays: 7,\n',
    );
    expect(code?.querySelectorAll('[data-change]')).toHaveLength(2);
    expect(code?.style.color).toBe('var(--foreground)');
  });

  const verifyDiffWhitespace = async (
    language: string,
    prefersWrappedCode: boolean,
  ): Promise<void> => {
    const source = '-  old setting\r\n+  new setting\r\n\r\n context\r\n+<script>literal</script>';

    await act(async () => {
      root.render(
        <CodeBlock
          language={language}
          prefersWrappedCode={prefersWrappedCode}
        >
          {source}
        </CodeBlock>,
      );

      await Promise.resolve();
    });

    const code = container.querySelector<HTMLElement>('pre code');

    expect(code?.textContent).toBe(source);
    expect(code?.style.whiteSpace).toBe(prefersWrappedCode ? 'pre-wrap' : 'pre');
    expect(code?.querySelector('script')).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy to Clipboard"]')?.click();

      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(source);
  };

  test.each([
    ['diff', false],
    ['diff-typescript', false],
    ['diff-unregistered', false],
  ] as const)(
    'CodeBlock(%s, prefersWrappedCode=%s) preserves whitespace, line endings, and copying',
    verifyDiffWhitespace,
  );

  test.each([
    ['diff', true],
    ['diff-typescript', true],
    ['diff-unregistered', true],
  ] as const)(
    'CodeBlock(%s, prefersWrappedCode=%s) preserves whitespace, line endings, and copying',
    { tags: ['full'] },
    verifyDiffWhitespace,
  );

  const verifyDiffOperators = async (
    language: string,
    theme: string,
    prefersWrappedCode: boolean,
    lineEnding: string,
  ): Promise<void> => {
    document.documentElement.className = theme;
    const source = [
      '--- a/count.ts',
      '+++ b/count.ts',
      '@@ -1 +1 @@ updateCounter',
      '---remaining;',
      '+++remaining;',
      '',
    ].join(lineEnding);

    await act(async () => {
      root.render(
        <CodeBlock
          language={language}
          prefersWrappedCode={prefersWrappedCode}
        >
          {source}
        </CodeBlock>,
      );

      await Promise.resolve();
    });

    const code = container.querySelector('pre code');
    expect(code?.textContent).toBe(source);
    expect(code?.querySelectorAll('[data-change]')).toHaveLength(2);
    expect(code?.querySelector('[data-change="removed"]')?.textContent).toBe(
      `---remaining;${lineEnding}`,
    );
    expect(code?.querySelector('[data-change="added"]')?.textContent).toBe(
      `+++remaining;${lineEnding}`,
    );
    if (language === 'diff-typescript') {
      for (const operator of ['--', '++']) {
        const token = Array.from(code?.querySelectorAll<HTMLSpanElement>('span') ?? []).find(
          (span) => span.textContent === operator,
        );
        expect(token?.style.color).toContain('color-mix(');
      }
    }

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy to Clipboard"]')?.click();

      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(source);
  };

  test.each([
    ['diff', 'light', false, '\n'],
    ['diff-typescript', 'light', false, '\n'],
  ] as const)(
    'CodeBlock(%s, %s, wrapped=%s) treats increment and decrement rows as hunk source',
    verifyDiffOperators,
  );

  test.each([['diff-typescript', 'dark', true, '\r\n']] as const)(
    'CodeBlock(%s, %s, wrapped=%s) treats increment and decrement rows as hunk source',
    { tags: ['full'] },
    verifyDiffOperators,
  );

  test('treats a YAML document delimiter as removed source and stops at the hunk boundary', () => {
    const source = [
      '--- a/settings.yml',
      '+++ b/settings.yml',
      '@@ -1,2 +1 @@',
      '----',
      ' enabled: true',
      '--- a/next.yml',
      '+++ b/next.yml',
      '@@ -0,0 +1 @@',
      '+enabled: true',
      '',
    ].join('\n');

    act(() => {
      root.render(<CodeBlock language="diff-yaml">{source}</CodeBlock>);
    });

    const code = container.querySelector('pre code');
    expect(code?.textContent).toBe(source);
    expect(code?.querySelectorAll('[data-change]')).toHaveLength(2);
    expect(code?.querySelector('[data-change="removed"]')?.textContent).toBe('----\n');
    expect(code?.querySelector('[data-change="added"]')?.textContent).toBe('+enabled: true\n');
    expect(
      Array.from(
        code?.querySelectorAll<HTMLSpanElement>('[data-change="removed"] span') ?? [],
      ).some((span) => span.textContent === '---' && span.style.color.includes('color-mix(')),
    ).toBe(true);
  });

  test('preserves string syntax when hunk source looks exactly like file headers', () => {
    document.documentElement.className = 'light';
    const source = [
      '--- a/example.ts',
      '+++ b/example.ts',
      '@@ -1,3 +1,3 @@',
      ' const label = `',
      '--- a/example.ts',
      '+++ b/example.ts',
      ' `;',
    ].join('\n');

    act(() => {
      root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
    });

    expect(container.querySelector('pre code')?.textContent).toBe(source);
    expect(container.querySelectorAll('[data-change]')).toHaveLength(2);
    for (const [change, content] of [
      ['removed', '-- a/example.ts'],
      ['added', '++ b/example.ts'],
    ]) {
      expect(
        Array.from(
          container.querySelectorAll<HTMLSpanElement>(`[data-change="${change}"] span`),
        ).some(
          (span) =>
            span.textContent === content &&
            span.style.color ===
              'color-mix(in srgb, var(--syntax-token-string, #2f6f31) 80%, var(--foreground))',
        ),
      ).toBe(true);
    }
  });

  test(
    'preserves multiline source syntax independently on both sides of a patch',
    { tags: ['full'] },
    () => {
      document.documentElement.className = 'light';
      const source = [
        '@@ -1,4 +1,4 @@',
        ' const message = `',
        '-old message',
        '+new message',
        ' end`;',
        ' const isReady = true;',
        '',
      ].join('\n');

      act(() => {
        root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
      });

      expect(container.querySelector('pre code')?.textContent).toBe(source);
      for (const change of ['removed', 'added']) {
        const row = container.querySelector(`[data-change="${change}"]`);
        const message = change === 'removed' ? 'old message' : 'new message';
        expect(
          Array.from(row?.querySelectorAll<HTMLSpanElement>('span') ?? []).some(
            (span) =>
              span.textContent === message &&
              span.style.color ===
                'color-mix(in srgb, var(--syntax-token-string, #2f6f31) 80%, var(--foreground))',
          ),
        ).toBe(true);
      }
    },
  );

  test(
    'keeps removed comments out of the added source and resets syntax between hunks',
    { tags: ['full'] },
    () => {
      document.documentElement.className = 'light';
      const source = [
        '@@ -1 +1 @@',
        '-/* removed comment',
        '+const isReady = true;',
        '@@ -20 +20 @@',
        '-const name = "before";',
        '+const name = "after";',
      ].join('\n');

      act(() => {
        root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
      });

      const addedRows = container.querySelectorAll('[data-change="added"]');
      expect(addedRows).toHaveLength(2);
      for (const row of addedRows) {
        expect(
          Array.from(row.querySelectorAll<HTMLSpanElement>('span')).some(
            (span) =>
              span.textContent === 'const' &&
              span.style.color ===
                'color-mix(in srgb, var(--syntax-token-keyword, #8b1a89) 80%, var(--foreground))',
          ),
        ).toBe(true);
      }
      expect(
        Array.from(
          container.querySelectorAll<HTMLSpanElement>('[data-change="removed"] span'),
        ).some(
          (span) =>
            span.textContent === '/* removed comment' &&
            span.style.color ===
              'color-mix(in srgb, var(--syntax-token-comment, #5c6370) 80%, var(--foreground))',
        ),
      ).toBe(true);
      expect(container.querySelector('pre code')?.textContent).toBe(source);
    },
  );

  test.each(['', '+', '-\n+\n', '+const count = 7;\n', '-const count = 7;', ' context\n'])(
    'CodeBlock(diff-typescript, %s) preserves empty and one-sided excerpts',
    (source) => {
      act(() => {
        root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
      });

      expect(container.querySelector('pre code')?.textContent).toBe(source);
    },
  );

  test(
    'keeps syntax context across a no-newline annotation without highlighting the annotation',
    { tags: ['full'] },
    () => {
      document.documentElement.className = 'light';
      const source = [
        ' const message = `',
        '-before`;',
        '\\ No newline at end of file',
        '+after`;',
        '\\ No newline at end of file',
      ].join('\n');

      act(() => {
        root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
      });

      const addedTokens = Array.from(
        container.querySelectorAll<HTMLSpanElement>('[data-change="added"] span'),
      );
      expect(
        addedTokens.some(
          (span) =>
            span.textContent === 'after' &&
            span.style.color ===
              'color-mix(in srgb, var(--syntax-token-string, #2f6f31) 80%, var(--foreground))',
        ),
      ).toBe(true);
      expect(container.querySelector('pre code')?.textContent).toBe(source);
      const annotation = Array.from(container.querySelectorAll<HTMLSpanElement>('span')).find(
        (span) => span.textContent === '\\ No newline at end of file',
      );
      expect(annotation?.querySelector('[style*="color"]')).toBeNull();
    },
  );

  test('maps all source rows in a large excerpt back to their original patch positions', () => {
    const source = Array.from(
      { length: 512 },
      (_, index) => `-const before${index} = ${index};\n+const after${index} = ${index + 1};\n`,
    ).join('');

    act(() => {
      root.render(<CodeBlock language="diff-typescript">{source}</CodeBlock>);
    });

    expect(container.querySelector('pre code')?.textContent).toBe(source);
    expect(container.querySelectorAll('[data-change="removed"]')).toHaveLength(512);
    expect(container.querySelectorAll('[data-change="added"]')).toHaveLength(512);
  });

  test(
    'renders code block content with horizontal overflow when wrapping is disabled',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <CodeBlock
            language="text"
            shouldWrapContent={false}
          >
            const token = 'abc123';
          </CodeBlock>,
        );
      });

      const codeBlock = container.querySelector('pre');
      const codeElement = container.querySelector('code');

      expect(codeBlock?.tabIndex).toBe(0);
      expect(codeBlock?.className).toContain('overflow-x-auto');
      expect(codeBlock?.className).not.toContain('overflow-x-hidden');
      expect(codeElement?.style.whiteSpace).toBe('pre');
    },
  );

  test('preserves the caller’s code-region keyboard policy', { tags: ['full'] }, () => {
    act(() =>
      root.render(
        <CodeBlock
          prefersWrappedCode={false}
          tabIndex={-1}
        >
          Long source
        </CodeBlock>,
      ),
    );
    expect(container.querySelector('pre')?.tabIndex).toBe(-1);
    act(() =>
      root.render(
        <CodeBlock
          prefersWrappedCode
          tabIndex={0}
        >
          Wrapped source
        </CodeBlock>,
      ),
    );
    expect(container.querySelector('pre')?.tabIndex).toBe(0);
  });

  test('wraps code block content when requested', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <CodeBlock
          language="text"
          shouldWrapContent={true}
        >
          const longIdentifier = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';
        </CodeBlock>,
      );
    });

    const codeBlock = container.querySelector('pre');
    const codeElement = container.querySelector('code');

    expect(codeBlock?.className).toContain('overflow-x-hidden');
    expect(codeBlock?.className).toContain('wrap-anywhere');
    expect(codeElement?.style.whiteSpace).toBe('pre-wrap');
  });

  test('custom source metadata and icons preserve the authored header slots', () => {
    act(() =>
      root.render(
        <CodeFileHeader
          fileIcon={<span>Custom icon</span>}
          headerLabel="Authored source"
          headerRole="Agent output"
          headerMeta="Revision 2"
          fileStatus="added"
        />,
      ),
    );
    expect(container.textContent).toContain('Custom icon');
    expect(container.textContent).toContain('Authored source');
    expect(container.textContent).toContain('Agent output');
    expect(container.textContent).toContain('Revision 2');
    expect(container.querySelector('[aria-label="Added"]')?.textContent).toBe('A');
    act(() =>
      root.render(
        <CodeFileHeader
          filePath="root.json"
          headerMeta="Revision 3"
          fileStatus="removed"
        />,
      ),
    );
    expect(container.querySelector('[title="root.json"]')?.textContent).toBe('root.json');
    expect(container.querySelector('[aria-label="Removed"]')?.textContent).toBe('D');
  });
  test('an authored header can omit both optional control groups', () => {
    act(() =>
      root.render(
        <CodeBlock
          language="typescript"
          headerLabel="Authored source"
          hasCopyButton={false}
          hasPreferencesControls={false}
        >
          const isReady = true;
        </CodeBlock>,
      ),
    );
    expect(container.textContent).toContain('Authored source');
    expect(container.querySelector('[data-slot="code-block-actions"]')).toBeNull();
  });
  test('hiding preferences retains the independent copy action', () => {
    act(() => root.render(<CodeBlock hasPreferencesControls={false}>source</CodeBlock>));
    expect(container.querySelector('[aria-label="Copy to Clipboard"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="code-preferences-controls"]')).toBeNull();
  });
  test('unrelated remote preference saves do not repeat syntax highlighting', async () => {
    let finishSave!: () => void;
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
    const renderSyntax = vi.mocked(CodeBlockSyntaxHighlighter);
    try {
      await act(async () => {
        root.render(
          <UiPreferencesProvider
            mode="remote"
            initialPreferences={DEFAULT_UI_PREFERENCES}
            persistPreferences={persistPreferences}
          >
            <PreferenceAction />
            <CodeBlock language="typescript">const isReady = true;</CodeBlock>
          </UiPreferencesProvider>,
        );
        await Promise.resolve();
      });
      const initialRenders = renderSyntax.mock.calls.length;
      expect(initialRenders).toBeGreaterThan(0);
      await act(async () => {
        container.querySelector('button')?.click();
        await Promise.resolve();
      });
      expect(renderSyntax).toHaveBeenCalledTimes(initialRenders);
      await act(async () => {
        finishSave();
        await Promise.resolve();
      });
      expect(renderSyntax).toHaveBeenCalledTimes(initialRenders);
    } finally {
      renderSyntax.mockClear();
    }
  });
});
