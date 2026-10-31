import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from './index.js';

test.each([
  [
    'SelectTrigger',
    <Select>
      <SelectTrigger asChild>Invalid</SelectTrigger>
    </Select>,
  ],
  [
    'SelectValue',
    <Select>
      <SelectValue asChild>Invalid</SelectValue>
    </Select>,
  ],
  [
    'SelectContent',
    <Select>
      <SelectContent asChild>Invalid</SelectContent>
    </Select>,
  ],
  [
    'SelectItem',
    <Select>
      <SelectItem
        asChild
        value="a"
      >
        Invalid
      </SelectItem>
    </Select>,
  ],
  ['Checkbox', <Checkbox asChild>Invalid</Checkbox>],
  [
    'RadioGroupItem',
    <RadioGroup>
      <RadioGroupItem
        asChild
        value="a"
      >
        Invalid
      </RadioGroupItem>
    </RadioGroup>,
  ],
  ['Switch', <Switch asChild>Invalid</Switch>],
])('%s rejects malformed slotted content', { tags: ['full'] }, (name, element) => {
  expect(() => renderToStaticMarkup(element)).toThrow(
    `${name} asChild requires exactly one valid React element child.`,
  );
});
