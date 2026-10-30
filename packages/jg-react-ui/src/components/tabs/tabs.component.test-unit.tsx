import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Tabs, TabsList, TabsTrigger } from './index.js';

test.each([
  [<TabsTrigger value="a">Outside</TabsTrigger>, 'TabsTrigger must be rendered inside TabsList.'],
  [
    <Tabs>
      <TabsList overflowBehavior="truncate">
        <TabsTrigger value="a">
          <span>Composite</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>,
    'TabsTrigger with composite children requires title or aria-label when TabsList truncates.',
  ],
  [
    <Tabs>
      <TabsList overflowBehavior="scroll">
        <TabsTrigger
          asChild
          value="a"
        >
          Invalid
        </TabsTrigger>
      </TabsList>
    </Tabs>,
    'TabsTrigger asChild requires exactly one valid React element child.',
  ],
])('TabsTrigger reports its invalid composition: %s', (element, message) => {
  expect(() => renderToStaticMarkup(element)).toThrow(message);
});
