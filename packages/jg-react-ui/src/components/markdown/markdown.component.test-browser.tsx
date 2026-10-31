import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ExtraProps } from 'react-markdown';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { UiPreferencesProvider } from '../ui-preferences-provider/index.js';
import { Markdown } from './index.js';

const VIDEO_ID = 'M7lc1UVf-VE';

const MarkdownParagraphOverride = ({ children }: ComponentProps<'p'>) => (
  <p data-slot="markdown-paragraph-override">{children}</p>
);

/** Renders Markdown anchors through React Router for override-precedence coverage. */
const MarkdownRouterLink = ({
  children,
  href,
  node,
}: ComponentProps<'a'> & ExtraProps): React.ReactElement => {
  void node;

  return <Link to={href ?? '/'}>{children}</Link>;
};

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('Markdown', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalDocumentClassName: string;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    originalDocumentClassName = document.documentElement.className;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.documentElement.className = originalDocumentClassName;
  });

  test.each(['light', 'dark'])(
    'caps an authored image width in the %s theme',
    { tags: ['full'] },
    (theme) => {
      document.documentElement.className = theme;
      act(() => {
        root.render(
          <Markdown>
            {'![System diagram](/diagram.webp "width=560")\n\n![Full diagram](/diagram.webp)'}
          </Markdown>,
        );
      });

      const [sizedImage, fullImage] = container.querySelectorAll('img');
      expect(sizedImage?.getAttribute('src')).toBe('/diagram.webp');
      expect(sizedImage?.getAttribute('alt')).toBe('System diagram');
      expect(sizedImage?.style.maxWidth).toBe('560px');
      expect(sizedImage?.getAttribute('title')).toBeNull();
      expect(sizedImage?.getAttribute('loading')).toBe('lazy');
      expect(fullImage?.style.maxWidth).toBe('');
    },
  );

  test.each(['System diagram', 'width=0', 'width=-1', 'width=560px'])(
    'preserves the ordinary or invalid image title %s without applying a width',
    { tags: ['full'] },
    (title) => {
      act(() => {
        root.render(<Markdown>{`![System diagram](/diagram.webp "${title}")`}</Markdown>);
      });

      const image = container.querySelector('img');
      expect(image?.style.maxWidth).toBe('');
      expect(image?.getAttribute('title')).toBe(title);
    },
  );

  test.each([
    [
      `[Product walkthrough](https://www.youtube.com/watch?v=${VIDEO_ID}&autoplay=1&t=30)`,
      'Product walkthrough',
    ],
    [`https://youtu.be/${VIDEO_ID}`, 'YouTube video'],
  ])('renders the standalone YouTube link %s as a player', (markdown, expectedTitle) => {
    act(() => {
      root.render(<Markdown>{markdown}</Markdown>);
    });

    const iframe = container.querySelector('iframe');

    expect(container.querySelectorAll('[data-slot="youtube-video"]')).toHaveLength(1);
    expect(iframe?.getAttribute('src')).toBe(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`);
    expect(iframe?.getAttribute('src')).not.toContain('autoplay');
    expect(iframe?.getAttribute('title')).toBe(expectedTitle);
  });

  test.each([
    [`Watch [the walkthrough](https://youtu.be/${VIDEO_ID}) now.`, 'the walkthrough'],
    [`[**Product walkthrough**](https://youtu.be/${VIDEO_ID})`, 'Product walkthrough'],
    [
      `[Untrusted host](https://www.youtube.com.evil.example/watch?v=${VIDEO_ID})`,
      'Untrusted host',
    ],
    ['[Release playlist](https://www.youtube.com/playlist?list=PL123)', 'Release playlist'],
  ])('keeps the non-embeddable link in %s as an ordinary link', (markdown, expectedLinkText) => {
    act(() => {
      root.render(<Markdown>{markdown}</Markdown>);
    });

    const link = container.querySelector('a');

    expect(container.querySelector('iframe')).toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.textContent).toBe(`${expectedLinkText} (opens in a new tab)`);
  });

  test('keeps default-rendered links in the current tab when new-tab behavior is disabled', () => {
    act(() => {
      root.render(
        <Markdown shouldOpenLinksInNewTab={false}>{'[Knowledge base](/knowledge-base)'}</Markdown>,
      );
    });

    const link = container.querySelector('a');

    expect(link?.getAttribute('href')).toBe('/knowledge-base');
    expect(link?.getAttribute('target')).toBeNull();
    expect(link?.getAttribute('rel')).toBeNull();
    expect(link?.querySelector('[data-slot="new-tab-indicator"]')).toBeNull();
  });

  test('opens absolute and relative web links in secure new tabs by default', () => {
    act(() => {
      root.render(
        <Markdown>
          {
            '[External](https://example.com/guide)\n\n[Same domain](https://moldea.ai/guide)\n\n[Relative](/guide)'
          }
        </Markdown>,
      );
    });

    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(new Set(link.getAttribute('rel')?.split(' '))).toStrictEqual(
        new Set(['noopener', 'noreferrer']),
      );
      expect(link.querySelectorAll('[data-slot="new-tab-indicator"]')).toHaveLength(1);
      expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(link.textContent).toContain('(opens in a new tab)');
    }
  });

  test('keeps fragment and non-web links in the current tab by default', () => {
    act(() => {
      root.render(
        <Markdown>
          {'[Section](#security)\n\n[Email](mailto:jesus@moldea.ai)\n\n[Call](tel:+15551234567)'}
        </Markdown>,
      );
    });

    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute('target')).toBeNull();
      expect(link.getAttribute('rel')).toBeNull();
      expect(link.querySelector('[data-slot="new-tab-indicator"]')).toBeNull();
    }
  });

  test('leaves a custom React Router anchor renderer in full control of navigation', () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <Markdown components={{ a: MarkdownRouterLink }}>
            {'[Account settings](/account/settings)'}
          </Markdown>
        </MemoryRouter>,
      );
    });

    const link = container.querySelector('a');

    expect(link?.getAttribute('href')).toBe('/account/settings');
    expect(link?.getAttribute('target')).toBeNull();
    expect(link?.getAttribute('rel')).toBeNull();
    expect(link?.querySelector('[data-slot="new-tab-indicator"]')).toBeNull();
    expect(link?.textContent).toBe('Account settings');
  });

  test('keeps raw iframe HTML disabled', () => {
    act(() => {
      root.render(
        <Markdown>{`<iframe src="https://www.youtube.com/embed/${VIDEO_ID}"></iframe>\n\nSafe text.`}</Markdown>,
      );
    });

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent?.trim()).toBe('Safe text.');
  });

  test(
    'preserves a consumer paragraph override for standalone YouTube links',
    { tags: ['full'] },
    () => {
      act(() => {
        root.render(
          <Markdown components={{ p: MarkdownParagraphOverride }}>
            {`[Product walkthrough](https://youtu.be/${VIDEO_ID})`}
          </Markdown>,
        );
      });

      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('[data-slot="markdown-paragraph-override"]')).not.toBeNull();
      expect(container.querySelector('a')?.textContent).toBe(
        'Product walkthrough (opens in a new tab)',
      );
    },
  );

  test('highlights uppercase template variables in rendered text', { tags: ['full'] }, () => {
    act(() => {
      root.render(<Markdown>{'Hello {{FIRST_NAME}}, review {{PROJECT_STATUS}}.'}</Markdown>);
    });

    const variables = Array.from(container.querySelectorAll('[data-slot="markdown-variable"]'));

    expect(variables.map((variable) => variable.textContent)).toStrictEqual([
      '{{FIRST_NAME}}',
      '{{PROJECT_STATUS}}',
    ]);
    expect(variables.every((variable) => variable.tagName === 'MARK')).toBe(true);
    expect(variables[0]?.className).toContain('bg-foreground/10');
    expect(variables[0]?.className).toContain('text-foreground');
    expect(container.textContent).toBe('Hello {{FIRST_NAME}}, review {{PROJECT_STATUS}}.');
  });

  test('preserves variable text inside inline code without adding highlights', () => {
    act(() => {
      root.render(<Markdown>{'Use `{{RAW_VARIABLE}}` and render {{DISPLAY_VARIABLE}}.'}</Markdown>);
    });

    const inlineCode = container.querySelector('code');
    const variables = Array.from(container.querySelectorAll('[data-slot="markdown-variable"]'));

    expect(inlineCode?.textContent).toBe('{{RAW_VARIABLE}}');
    expect(inlineCode?.querySelector('[data-slot="markdown-variable"]')).toBeNull();
    expect(variables.map((variable) => variable.textContent)).toStrictEqual([
      '{{DISPLAY_VARIABLE}}',
    ]);
  });

  test('keeps inline code font size relative inside headings', { tags: ['full'] }, () => {
    act(() => {
      root.render(<Markdown>{'# Use `API_TOKEN` safely'}</Markdown>);
    });

    const heading = container.querySelector('h1');
    const inlineCode = heading?.querySelector('code');

    expect(heading?.textContent).toBe('Use API_TOKEN safely');
    expect(inlineCode?.className).toContain('text-[0.86em]');
    expect(inlineCode?.className).not.toContain('text-sm');
  });

  test.each([
    ['light', 'var(--syntax-token-constant, #8a4b00)'],
    ['dark', 'var(--syntax-token-constant, #d19a66)'],
  ])(
    'Markdown(yaml, %s) renders highlighted configuration keys',
    { tags: ['full'] },
    (theme, expectedKeyColor) => {
      document.documentElement.className = theme;
      const source = 'agents:\n  board-assistant:\n    enabled: true\n';

      act(() => {
        root.render(<Markdown>{`\`\`\`yaml\n${source}\`\`\``}</Markdown>);
      });

      const key = Array.from(container.querySelectorAll<HTMLSpanElement>('pre span')).find(
        (span) => span.textContent === 'agents',
      );

      expect(container.querySelector('[data-slot="code-block-language"]')?.textContent).toBe(
        'YAML',
      );
      expect(container.querySelector('pre code')?.textContent).toBe(source);
      expect(key?.textContent).toBe('agents');
      expect(key?.style.color).toBe(expectedKeyColor);
    },
  );

  const verifyMarkdownDiff = (theme: string): void => {
    document.documentElement.className = theme;
    const source = '-const purgeAfterDays = 30;\n+const purgeAfterDays = 7;\n';

    act(() => {
      root.render(<Markdown>{`\`\`\`diff\n${source}\`\`\``}</Markdown>);
    });

    const code = container.querySelector<HTMLElement>('pre code');

    expect(container.querySelector('[data-slot="code-block-language"]')?.textContent).toBe('Diff');
    expect(code?.textContent).toBe(source);
    expect(code?.querySelector('[data-change="removed"]')?.textContent).toBe(
      '-const purgeAfterDays = 30;\n',
    );
    expect(code?.querySelector('[data-change="added"]')?.textContent).toBe(
      '+const purgeAfterDays = 7;\n',
    );
    expect(code?.style.color).toBe('var(--foreground)');
  };

  test.each(['light'] as const)(
    'Markdown(diff, %s) distinguishes removed and added lines',
    verifyMarkdownDiff,
  );

  test.each(['dark'] as const)(
    'Markdown(diff, %s) distinguishes removed and added lines',
    { tags: ['full'] },
    verifyMarkdownDiff,
  );

  const verifyMarkdownDiffSyntax = (
    theme: string,
    language: string,
    label: string,
    sourceLine: string,
    tokenText: string,
    expectedColor: string,
  ): void => {
    document.documentElement.className = theme;
    const source = `--- a/settings\n+++ b/settings\n@@ -1 +1 @@\n-${sourceLine}\n+${sourceLine}\n`;

    act(() => {
      root.render(<Markdown>{`\`\`\`diff-${language}\n${source}\`\`\``}</Markdown>);
    });

    const code = container.querySelector<HTMLElement>('pre code');
    expect(container.querySelector('[data-slot="code-block-language"]')?.textContent).toBe(
      `Diff (${label})`,
    );
    expect(code?.textContent).toBe(source);
    expect(code?.querySelectorAll('[data-change]')).toHaveLength(2);
    for (const change of ['removed', 'added']) {
      const token = Array.from(
        code?.querySelectorAll<HTMLSpanElement>(`[data-change="${change}"] span`) ?? [],
      ).find((span) => span.textContent === tokenText);
      expect(token?.style.color).toBe(
        `color-mix(in srgb, var(--syntax-token-${tokenText === '7' ? 'constant' : 'keyword'}, ${expectedColor}) 80%, var(--foreground))`,
      );
    }
    const metadata = Array.from(code?.querySelectorAll<HTMLSpanElement>('span') ?? []).find(
      (span) => span.textContent === '@@ -1 +1 @@',
    );
    expect(metadata?.querySelector('[style*="color"]')).toBeNull();
  };

  test.each([
    ['light', 'typescript', 'TypeScript', 'const count = 7;', 'const', '#8b1a89'],
    ['light', 'yaml', 'YAML', 'count: 7', '7', '#8a4b00'],
    ['light', 'sql', 'SQL', 'SELECT app_user.id FROM app_user;', 'SELECT', '#8b1a89'],
  ] as const)(
    'Markdown(%s, diff-%s) combines source syntax with patch markers',
    { tags: ['full'] },
    verifyMarkdownDiffSyntax,
  );

  test.each([
    ['dark', 'typescript', 'TypeScript', 'const count = 7;', 'const', '#c678dd'],
    ['dark', 'yaml', 'YAML', 'count: 7', '7', '#d19a66'],
    ['dark', 'sql', 'SQL', 'SELECT app_user.id FROM app_user;', 'SELECT', '#c678dd'],
  ] as const)(
    'Markdown(%s, diff-%s) combines source syntax with patch markers',
    { tags: ['full'] },
    verifyMarkdownDiffSyntax,
  );

  test('updates fenced-code wrapping through the editable provider', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <UiPreferencesProvider mode="local">
          <Markdown>{'```typescript\nconst text = 1;\n```'}</Markdown>
        </UiPreferencesProvider>,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Line wrapping: Scroll"]')
        ?.click();
    });

    const wrapOption = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-radio-item"]'),
    ).find((menuItem) => menuItem.textContent?.includes('Wrap lines'));

    act(() => {
      wrapOption?.click();
    });

    expect(container.querySelector('pre')?.className).toContain('wrap-anywhere');
  });
  test('preserves an unlabelled code fence as a block with exact whitespace', () => {
    const source = '  first line\n\tsecond line\n';
    act(() => root.render(<Markdown>{`\`\`\`\n${source}\`\`\``}</Markdown>));
    expect(container.querySelector('pre code')?.textContent).toBe(source);
  });
  test(
    'renders the complete GFM prose and table surface with semantic elements',
    { tags: ['full'] },
    () => {
      const content =
        '# Title\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\n> Quoted result\n\n1. First\n2. Second\n\n- [x] Complete\n- [ ] Pending\n\n~~Removed~~\n\n---\n\n| Name | State |\n| --- | --- |\n| Build | Ready |\n\nA footnote[^note].\n\n[^note]: Supporting text.';
      act(() => root.render(<Markdown>{content}</Markdown>));
      for (const level of [1, 2, 3, 4, 5, 6])
        expect(container.querySelector(`h${level}`)).not.toBeNull();
      expect(container.querySelector('blockquote')?.textContent).toContain('Quoted result');
      expect(container.querySelector('ol')?.textContent).toContain('Second');
      expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
      expect(container.querySelector('del')?.textContent).toBe('Removed');
      expect(container.querySelector('hr')).not.toBeNull();
      expect(container.querySelector('th')?.textContent).toBe('Name');
      expect(container.querySelector('td')?.textContent).toBe('Build');
      expect(container.querySelector('sup')).not.toBeNull();
      expect(container.querySelector('section')?.textContent).toContain('Supporting text.');
    },
  );

  test('custom plugins retain native non-checkbox input renderers', () => {
    const plugin = () => (tree: { children: unknown[] }) => {
      tree.children.push({
        type: 'element',
        tagName: 'input',
        properties: { type: 'text', ariaLabel: 'Embedded field', defaultValue: 'Authored' },
        children: [],
      });
    };
    act(() => root.render(<Markdown rehypePlugins={[plugin]}>Document</Markdown>));
    expect(container.querySelector('input[type="text"]')?.getAttribute('aria-label')).toBe(
      'Embedded field',
    );
  });

  test('unchanged parser inputs are not reprocessed after an unrelated parent update', () => {
    let parses = 0;
    const countParse = () => () => {
      parses += 1;
    };
    const plugins = [countParse];
    act(() =>
      root.render(
        <div>
          <span>First</span>
          <Markdown remarkPlugins={plugins}>Stable document</Markdown>
        </div>,
      ),
    );
    expect(parses).toBe(1);
    act(() =>
      root.render(
        <div>
          <span>Second</span>
          <Markdown remarkPlugins={plugins}>Stable document</Markdown>
        </div>,
      ),
    );
    expect(parses).toBe(1);
    act(() =>
      root.render(
        <div>
          <span>Second</span>
          <Markdown remarkPlugins={plugins}>Changed document</Markdown>
        </div>,
      ),
    );
    expect(parses).toBe(2);
  });
  test.each(['{{NAME}}', '{{FIRST}}{{SECOND}}', 'Before {{NAME}}'])(
    'variable boundaries preserve exact visible text (%s)',
    (content) => {
      act(() => root.render(<Markdown>{content}</Markdown>));
      expect(container.textContent).toBe(content);
      expect(container.querySelector('mark')).not.toBeNull();
    },
  );
});
