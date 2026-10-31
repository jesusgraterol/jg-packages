import { expect, test } from 'vitest';

import { renderDarkScopes } from './utilities.ts';

const THEME = '.dark {\n  --jg-background: black;\n}\n.dark {\n  --jg-syntax-foreground: white;\n}';

test('canonical dark declarations are scoped without independently authored colors', () => {
  expect(renderDarkScopes(THEME)).toBe(
    '/* Generated from jg-personal-ui/styles/theme.css by foundation:generate. */\n' +
      '.jg-section-inverse {\n  --jg-background: black;\n}\n\n' +
      '.jg-code-window,\n.jg-section-inverse {\n  --jg-syntax-foreground: white;\n}\n',
  );
  expect(renderDarkScopes(THEME.replace(/\n/g, '\r\n'))).toBe(renderDarkScopes(THEME));
});

test.each(['', '.dark {}', `${THEME}\n.dark {}`, THEME.replace('--jg-background', '--unknown')])(
  'rejects an unsupported shared theme %s',
  (theme) => {
    expect(() => renderDarkScopes(theme)).toThrow(
      'The shared foundation must expose exactly two supported dark declaration blocks.',
    );
  },
);
