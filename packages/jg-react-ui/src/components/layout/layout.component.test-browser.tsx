import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { Button } from '../button/index.js';
import {
  PageDescription,
  PageHeader,
  PageHeaderMetadata,
  PageHeaderRow,
  PageHeaderTitleGroup,
  PageShell,
  PageTitle,
  Inline,
  Stack,
  Surface,
} from './index.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('page header layout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('keeps long titles, metadata, and actions in the responsive header structure', () => {
    act(() =>
      root.render(
        <PageShell>
          <PageHeader>
            <PageHeaderRow>
              <PageHeaderTitleGroup>
                <PageTitle>System checks requiring a deliberately long page heading</PageTitle>
                <PageHeaderMetadata>Healthy</PageHeaderMetadata>
              </PageHeaderTitleGroup>
              <div>
                <Button type="button">Configure</Button>
              </div>
            </PageHeaderRow>
            <PageDescription>Latest persisted system status.</PageDescription>
          </PageHeader>
          <Surface aria-label="Workspace summary">
            <Stack>
              <Inline>Active workspace</Inline>
            </Stack>
          </Surface>
        </PageShell>,
      ),
    );

    const shell = container.querySelector('[data-slot="page-shell"]');
    const header = container.querySelector('[data-slot="page-header"]');
    const row = container.querySelector('[data-slot="page-header-row"]');
    const titleGroup = container.querySelector('[data-slot="page-header-title-group"]');
    const metadata = container.querySelector('[data-slot="page-header-metadata"]');
    const title = container.querySelector('[data-slot="page-title"]');
    const description = container.querySelector('[data-slot="page-description"]');

    expect(shell?.className).toContain('px-page-gutter');
    expect(header?.className).toContain('flow-root');
    expect(header?.className).toContain('min-w-0');
    expect(header?.className).toContain('sm:grid');
    expect(row?.className).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(row?.className).toContain('items-start');
    expect(titleGroup?.className).toContain('overflow-hidden');
    expect(metadata?.className).toContain('shrink-0');
    expect(title?.className).toContain('text-3xl');
    expect(title?.className).toContain('sm:text-4xl');
    expect(title?.className).toContain('font-bold');
    expect(title?.className).toContain('leading-[1.2]');
    expect(title?.className).toContain('tracking-normal');
    expect(title?.className).toContain('truncate');
    expect(title?.nextElementSibling).toBe(metadata);
    expect(description?.className).toContain('mt-1');
    expect(description?.className).toContain('sm:mt-0');
  });
});
