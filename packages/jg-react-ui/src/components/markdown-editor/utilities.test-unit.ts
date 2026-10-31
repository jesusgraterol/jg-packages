import { CrepeFeature } from '@milkdown/crepe';
import { expect, test, vi } from 'vitest';

import type * as Constants from './constants.js';

import { getMarkdownEditorCrepeConfig } from './utilities.js';

// exercise the icon serializer's own attribute contract without initializing a DOM editor.
vi.mock('./constants.js', async (importOriginal) => {
  const original = await importOriginal<typeof Constants>();
  return {
    ...original,
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES: {
      ...original.MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES,
      table: [['path', { d: 'M0 0h1', strokeLinecap: 'round', 'data-label': '<tag>"&' }]],
    },
  };
});

test('serializes camel-case SVG attributes and escapes quoted attribute content', () => {
  const config = getMarkdownEditorCrepeConfig({ isDarkMode: false, placeholder: 'e.g. Notes' });
  const icon = config.featureConfigs?.[CrepeFeature.BlockEdit]?.advancedGroup?.table?.icon;
  expect(icon).toContain('stroke-linecap="round"');
  expect(icon).toContain('data-label="&lt;tag&gt;&quot;&amp;"');
  expect(icon).not.toContain('<tag>');
  expect(icon).not.toContain('strokeLinecap');
});
