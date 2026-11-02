import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Spinner } from './index.js';

test(
  'Spinner exposes a loading status and preserves an authored accessible name',
  { tags: ['full'] },
  () => {
    const html = renderToStaticMarkup(<Spinner aria-label="Loading sessions" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading sessions"');
  },
);

test(
  'Spinner keeps decorative icons out of the accessibility tree and supplies its default loading name',
  { tags: ['full'] },
  () => {
    expect(renderToStaticMarkup(<Spinner />)).toContain('aria-label="Loading"');
    const decorative = renderToStaticMarkup(<Spinner aria-hidden />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain('role=');
    expect(decorative).not.toContain('aria-label=');
  },
);
