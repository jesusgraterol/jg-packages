import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test } from 'vitest';

import { PathText } from './path-text.component.js';
import { splitAtSeparators } from './utilities.js';

test.each([
  ['/home/me/projects/app', ['/', 'home/', 'me/', 'projects/', 'app']],
  ['C:\\Users\\me', ['C:\\', 'Users\\', 'me']],
  ['plan_1793757747.milestone-6', ['plan_', '1793757747.', 'milestone-', '6']],
  ['readme', ['readme']],
  ['', ['']],
])('splitAtSeparators(%s) -> %o', (path, pieces) => {
  expect(splitAtSeparators(path)).toStrictEqual(pieces);
});

test('renders the whole path with a break opportunity after each separator, which copying leaves out', () => {
  const container = document.createElement('code');
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<PathText path="/home/me/projects/jg-agent-hq" />);
  });

  expect(container.textContent).toBe('/home/me/projects/jg-agent-hq');
  // after each slash and each hyphen
  expect(container.querySelectorAll('wbr')).toHaveLength(6);
  act(() => {
    root.unmount();
  });
  container.remove();
});
