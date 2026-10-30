import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Tooltip, TooltipContent, TooltipTrigger } from './index.js';

test.each([
  ['TooltipTrigger', <TooltipTrigger asChild>Invalid</TooltipTrigger>],
  ['TooltipContent', <TooltipContent asChild>Invalid</TooltipContent>],
])('%s rejects malformed slotted content', (name, child) => {
  expect(() => renderToStaticMarkup(<Tooltip>{child}</Tooltip>)).toThrow(
    `${name} asChild requires exactly one valid React element child.`,
  );
});
