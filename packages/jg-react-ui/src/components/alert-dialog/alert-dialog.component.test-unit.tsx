import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from './index.js';

test.each([
  [
    <AlertDialogTrigger asChild>Invalid</AlertDialogTrigger>,
    'AlertDialogTrigger asChild requires exactly one valid React element child.',
  ],
  [
    <AlertDialogAction asChild>Invalid</AlertDialogAction>,
    'AlertDialogAction asChild requires exactly one valid React element child.',
  ],
  [
    <AlertDialogContent>
      <AlertDialogHeader />
    </AlertDialogContent>,
    'AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.',
  ],
  [
    <AlertDialogContent>
      <AlertDialogHeader />
      <AlertDialogFooter />
      Invalid
    </AlertDialogContent>,
    'AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.',
  ],
  [
    <AlertDialogContent>
      <AlertDialogHeader />
      <AlertDialogHeader />
      <AlertDialogFooter />
    </AlertDialogContent>,
    'AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.',
  ],
])('rejects invalid alert composition: %s', (element, message) => {
  expect(() => renderToStaticMarkup(<AlertDialog>{element}</AlertDialog>)).toThrow(message);
});
