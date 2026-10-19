// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';

import { useElementWidth } from '../element-width/index.js';
import { useDocumentTheme } from './document-theme.hook.js';

test('reads the light theme, and no width, in a server render', () => {
  const Page = () => {
    const theme = useDocumentTheme();
    const { value } = useElementWidth((width) => width);
    return `${theme}:${String(value)}`;
  };

  expect(renderToString(createElement(Page))).toBe('light:undefined');
});
