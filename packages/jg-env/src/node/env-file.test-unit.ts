// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { mergeEnvSources } from './env-file.js';

describe('mergeEnvSources', () => {
  test('lets a later source win, skipping undefined values', () => {
    expect(
      mergeEnvSources(
        { PORT: '3000', HOST: 'localhost', MODE: 'development' },
        { PORT: '4000', HOST: undefined },
        { MODE: 'production' },
      ),
    ).toStrictEqual({ PORT: '4000', HOST: 'localhost', MODE: 'production' });
  });

  test('gives an empty record for no sources, and leaves the sources unchanged', () => {
    const base = { A: '1' };

    expect(mergeEnvSources()).toStrictEqual({});
    expect(mergeEnvSources(base, { A: '2' })).toStrictEqual({ A: '2' });
    expect(base).toStrictEqual({ A: '1' });
  });

  test('keeps a __proto__ key as a plain variable', () => {
    const source = JSON.parse('{"__proto__":"value"}') as Record<string, string>;

    const merged = mergeEnvSources(source);

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.keys(merged)).toStrictEqual(['__proto__']);
  });
});
