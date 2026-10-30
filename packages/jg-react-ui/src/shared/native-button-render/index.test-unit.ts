import { createElement } from 'react';
import { expect, test } from 'vitest';

import { Button } from '../../components/button/index.js';

import { isNativeButtonRender } from './index.js';

test('native detection preserves Button slots and nested asChild element semantics', () => {
  expect(isNativeButtonRender(createElement('button'))).toBe(true);
  expect(isNativeButtonRender(createElement(Button))).toBe(true);
  expect(isNativeButtonRender(createElement(Button, { asChild: true }, createElement('a')))).toBe(
    false,
  );
  expect(
    isNativeButtonRender(createElement(Button, { asChild: true }, createElement('button'))),
  ).toBe(true);
  expect(isNativeButtonRender(createElement('span'))).toBe(false);
  expect(isNativeButtonRender('text')).toBe(false);
  expect(isNativeButtonRender(null)).toBe(false);
  const Unknown = () => createElement('button');
  expect(isNativeButtonRender(createElement(Unknown))).toBe(false);
});
