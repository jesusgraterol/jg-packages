import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './index.js';

test.each([
  [
    <DialogTrigger asChild>Invalid</DialogTrigger>,
    'DialogTrigger asChild requires exactly one valid React element child.',
  ],
  [
    <DialogClose asChild>Invalid</DialogClose>,
    'DialogClose asChild requires exactly one valid React element child.',
  ],
  [<DialogHeader>Outside</DialogHeader>, 'DialogHeader must be rendered inside DialogContent.'],
  [<DialogBody>Outside</DialogBody>, 'DialogBody must be rendered inside DialogContent.'],
  [<DialogFooter>Outside</DialogFooter>, 'DialogFooter must be rendered inside DialogContent.'],
  [<DialogCancel>Outside</DialogCancel>, 'DialogCancel must be rendered inside DialogContent.'],
  [
    <DialogContent
      asChild
      size="small"
    >
      Invalid
    </DialogContent>,
    'DialogContent asChild requires exactly one valid React element child.',
  ],
  [
    <DialogContent size="small">
      <DialogBody>Missing header</DialogBody>
    </DialogContent>,
    'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
  ],
  [
    <DialogContent size="small">
      <DialogHeader />
      <DialogBody />
      Unexpected
    </DialogContent>,
    'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
  ],
  [
    <DialogContent size="small">
      <DialogHeader />
      <DialogHeader />
      <DialogBody />
    </DialogContent>,
    'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
  ],
  [
    <DialogContent size="small">
      <DialogHeader />
      <DialogBody />
      <DialogFooter />
      <DialogFooter />
    </DialogContent>,
    'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
  ],
])('rejects invalid dialog composition: %s', (element, message) => {
  expect(() => renderToStaticMarkup(<Dialog>{element}</Dialog>)).toThrow(message);
});

test('imports and renders a closed root on the server without browser effects', () => {
  expect(
    renderToStaticMarkup(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent size="medium">
          <DialogHeader>
            <DialogTitle>Workspace</DialogTitle>
          </DialogHeader>
          <DialogBody>Settings</DialogBody>
        </DialogContent>
      </Dialog>,
    ),
  ).toContain('Open');
});
