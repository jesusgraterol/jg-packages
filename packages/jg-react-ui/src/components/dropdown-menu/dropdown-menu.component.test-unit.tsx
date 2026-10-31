import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './index.js';

test.each([
  ['DropdownMenuTrigger', <DropdownMenuTrigger asChild>Invalid</DropdownMenuTrigger>],
  ['DropdownMenuContent', <DropdownMenuContent asChild>Invalid</DropdownMenuContent>],
  ['DropdownMenuItem', <DropdownMenuItem asChild>Invalid</DropdownMenuItem>],
  [
    'DropdownMenuCheckboxItem',
    <DropdownMenuCheckboxItem asChild>Invalid</DropdownMenuCheckboxItem>,
  ],
  [
    'DropdownMenuRadioItem',
    <DropdownMenuRadioGroup>
      <DropdownMenuRadioItem
        asChild
        value="a"
      >
        Invalid
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>,
  ],
  [
    'DropdownMenuSubTrigger',
    <DropdownMenuSub>
      <DropdownMenuSubTrigger asChild>Invalid</DropdownMenuSubTrigger>
    </DropdownMenuSub>,
  ],
])('%s rejects malformed slotted content', { tags: ['full'] }, (name, child) => {
  expect(() => renderToStaticMarkup(<DropdownMenu>{child}</DropdownMenu>)).toThrow(
    `${name} asChild requires exactly one valid React element child.`,
  );
});
