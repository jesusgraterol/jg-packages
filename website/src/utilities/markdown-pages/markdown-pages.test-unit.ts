import { describe, expect, test } from 'vitest';

import { buildHomeMarkdown, buildPackageMarkdown, toMarkdownPath } from './markdown-pages.ts';

describe('toMarkdownPath', () => {
  test("gives index.md in the page's directory", () => {
    expect(toMarkdownPath('/')).toBe('/index.md');
    expect(toMarkdownPath('/packages/jg-one/recipes/')).toBe('/packages/jg-one/recipes/index.md');
  });
});

describe('buildPackageMarkdown', () => {
  test('writes the header, then the README sections and the API reference as given', () => {
    const markdown = buildPackageMarkdown(
      { description: 'Errors.', name: 'jg-one', runtimes: ['Universal'], version: '1.2.0' },
      {
        npmUrl: 'https://npm.example/jg-one',
        recipesUrl: 'https://example.dev/packages/jg-one/recipes/index.md',
        sourceUrl: 'https://github.example/jg-one',
      },
      '## Usage\n\nUse it.\n',
      '## jg-one API reference\n\nEvery export.\n',
    );

    expect(markdown).toBe(
      [
        '# jg-one',
        '',
        '> Errors.',
        '',
        '- **Version:** `1.2.0`',
        '- **Runtimes:** Universal',
        '- **Install:** `npm install jg-one`',
        '- **On npm:** [jg-one](https://npm.example/jg-one)',
        '- **Source:** [packages/jg-one](https://github.example/jg-one)',
        '- **Recipes:** [jg-one recipes](https://example.dev/packages/jg-one/recipes/index.md)',
        '',
        '## Usage',
        '',
        'Use it.',
        '',
        '## jg-one API reference',
        '',
        'Every export.',
        '',
      ].join('\n'),
    );
  });
});

describe('buildHomeMarkdown', () => {
  const markdown = buildHomeMarkdown({
    agentResources: [
      { path: 'node_modules/<package>/API.md', text: 'The reference.' },
      { href: '/llms.txt', path: '/llms.txt', text: 'The index.' },
    ],
    benefits: [{ text: 'Less to review.', title: 'Less code' }],
    groups: [
      {
        heading: 'Node.js',
        packages: [
          { description: 'Files.', name: 'jg-fs', runtimes: ['Node.js'], version: '1.0.0' },
        ],
        summary: 'For servers.',
      },
    ],
    hero: { lede: 'Tested code.' },
    sections: {
      agents: { eyebrow: 'Docs for agents', lede: 'Markdown.', title: 'Docs.' },
      packages: { eyebrow: 'The packages', lede: 'One job each.', title: 'Packages.' },
      setup: { eyebrow: 'Set up your agent', lede: 'Two steps.', title: 'Setup.' },
      why: { eyebrow: 'Why agents use them', lede: 'Less code.', title: 'Why.' },
    },
    setup: {
      installCommand: 'npx skills add example',
      policyUrl: 'https://policy.example',
      skillUrl: 'https://skill.example',
      steps: {
        policy: { text: 'Add `## jg-example`.', title: 'Add the policy' },
        skill: { text: 'It picks packages.', title: 'Install the skill' },
      },
    },
    site: { description: 'Packages for agents.', name: 'jg-example', url: 'https://example.dev' },
  });

  test('starts with the title, the summary, and the hero', () => {
    expect(markdown.startsWith('# jg-example\n\n> Packages for agents.\n\nTested code.\n\n')).toBe(
      true,
    );
  });

  test("links each package to its Markdown version, under its runtime's heading", () => {
    expect(markdown).toContain(
      '### Node.js\n\nFor servers.\n\n- [jg-fs](https://example.dev/packages/jg-fs/index.md): Files.',
    );
  });

  test('writes the setup steps with the policy, the skill, and the command', () => {
    expect(markdown).toContain(
      '1. **Add the policy:** Add `## jg-example`. [Open the policy](https://policy.example), and read [about the skill](https://skill.example).',
    );
    expect(markdown).toContain('   ```bash\n   npx skills add example\n   ```');
  });

  test('links the resources the site serves, and names the others as code', () => {
    expect(markdown).toContain('- `node_modules/<package>/API.md`: The reference.');
    expect(markdown).toContain('- [`/llms.txt`](https://example.dev/llms.txt): The index.');
  });
});
