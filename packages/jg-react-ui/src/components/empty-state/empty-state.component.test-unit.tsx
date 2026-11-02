import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { EmptyState, EmptyStateDescription, EmptyStateTitle } from './index.js';

test(
  'EmptyState preserves authored heading, description associations and child semantics',
  { tags: ['full'] },
  () => {
    const html = renderToStaticMarkup(
      <EmptyState
        aria-labelledby="empty-title"
        aria-describedby="empty-description"
      >
        <EmptyStateTitle id="empty-title">No sessions yet</EmptyStateTitle>
        <EmptyStateDescription asChild>
          <p id="empty-description">Create your first session.</p>
        </EmptyStateDescription>
      </EmptyState>,
    );
    expect(html).toContain('aria-labelledby="empty-title"');
    expect(html).toContain('aria-describedby="empty-description"');
    expect(html).toContain('data-slot="empty-state-title"');
    expect(html).toContain('id="empty-description"');
    expect(
      renderToStaticMarkup(
        <EmptyState asChild>
          <section aria-label="Empty sessions">
            <EmptyStateTitle asChild>
              <h2>Sessions</h2>
            </EmptyStateTitle>
            <EmptyStateDescription>Nothing to display.</EmptyStateDescription>
          </section>
        </EmptyState>,
      ),
    ).toContain('<h2 ');
  },
);

test('EmptyState rejects malformed slotted content', { tags: ['full'] }, () => {
  expect(() => renderToStaticMarkup(<EmptyState asChild>Invalid</EmptyState>)).toThrow(
    'asChild requires exactly one valid React element child.',
  );
});
