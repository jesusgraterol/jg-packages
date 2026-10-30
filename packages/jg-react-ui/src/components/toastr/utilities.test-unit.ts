import { expect, test } from 'vitest';

import { TOASTR_CLASS_NAMES } from './constants.js';
import { mergeToastrClassNames } from './utilities.js';

test('toast class overrides retain the source defaults and unknown Sonner slots', () => {
  expect(mergeToastrClassNames()).toMatchObject(TOASTR_CLASS_NAMES);
  const result = mergeToastrClassNames({
    toast: 'consumer-toast',
    info: 'consumer-info',
    title: 'consumer-title',
  });
  expect(result.toast).toContain('consumer-toast');
  expect(result.toast).toContain('toast');
  expect(result.title).toContain('consumer-title');
  expect(result.title).toContain('col-start-2');
  expect(result.info).toBe('consumer-info');
  expect(result.closeButton).toBe(TOASTR_CLASS_NAMES.closeButton);
});
