import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Divider } from './index.js';

test(
  'Divider keeps semantic separators distinct from decorative horizontal and vertical rules',
  { tags: ['full'] },
  () => {
    expect(renderToStaticMarkup(<Divider decorative={false} />)).toContain('role="separator"');
    const vertical = renderToStaticMarkup(
      <Divider
        decorative={false}
        orientation="vertical"
        aria-label="Panel boundary"
      />,
    );
    expect(vertical).toContain('aria-orientation="vertical"');
    const decorative = renderToStaticMarkup(
      <Divider
        decorative
        orientation="horizontal"
      />,
    );
    expect(decorative).not.toContain('role="separator"');
    expect(decorative).not.toContain('aria-orientation');
    expect(renderToStaticMarkup(<Divider />)).toContain('role="presentation"');
  },
);
