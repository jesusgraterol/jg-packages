import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { InlineCode } from './index.js';

test(
  'InlineCode introduces soft breaks at path separators while retaining the final extension and text',
  { tags: ['full'] },
  () => {
    const html = renderToStaticMarkup(<InlineCode>/src/answer-cache.ts</InlineCode>);
    expect(html).toContain('/src/<wbr/>answer-<wbr/>cache.ts');
    expect(html.replace(/<[^>]+>/g, '')).toBe('/src/answer-cache.ts');
    expect(
      renderToStaticMarkup(
        <InlineCode>
          <strong>Literal</strong>
        </InlineCode>,
      ),
    ).toContain('<strong>Literal</strong>');
  },
);
