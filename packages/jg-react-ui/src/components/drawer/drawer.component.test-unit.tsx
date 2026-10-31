import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from './index.js';

test.each([
  [
    <DrawerTrigger asChild>Invalid</DrawerTrigger>,
    'DrawerTrigger asChild requires exactly one valid React element child.',
  ],
  [
    <DrawerClose asChild>Invalid</DrawerClose>,
    'DrawerClose asChild requires exactly one valid React element child.',
  ],
  [
    <DrawerContent size="small">
      <DrawerBody />
    </DrawerContent>,
    'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
  ],
  [
    <DrawerContent size="small">
      <DrawerHeader />
      <DrawerBody />
      <DrawerFooter />
      <DrawerFooter />
    </DrawerContent>,
    'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
  ],
  [
    <DrawerContent size="small">
      <DrawerHeader />
      <DrawerBody />
      Invalid
    </DrawerContent>,
    'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
  ],
])('rejects invalid drawer composition: %s', { tags: ['full'] }, (element, message) => {
  expect(() => renderToStaticMarkup(<Drawer side="left">{element}</Drawer>)).toThrow(message);
});

test('rejects a panel without its drawer root', { tags: ['full'] }, () => {
  expect(() =>
    renderToStaticMarkup(
      <DrawerContent size="small">
        <DrawerHeader />
        <DrawerBody />
      </DrawerContent>,
    ),
  ).toThrow('DrawerContent must be rendered inside Drawer.');
});
