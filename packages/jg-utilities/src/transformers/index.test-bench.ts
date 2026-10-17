import { test } from 'vitest';
import { MOCK_STR } from './string.test-data.js';

/* ************************************************************************************************
 *                                           CONSTANTS                                            *
 ************************************************************************************************ */

const SUBSTITUTIONS = {
  TEST_1: 'high-quality',
  TEST_2: 'and avoid code fences',
  TEST_3: 'empathetic but firm',
  TEST_4: 'since the return window closed on January 15th.',
  TEST_8: 'or escalation to a manager if needed.',
  TEST_9:
    "help users draft polite but firm customer support responses that address the user's situation clearly, maintain professionalism, and protect the company's position when needed.",
  TEST_10: 'Keep the message practical and ready to send.',
};

/* ************************************************************************************************
 *                                             MOCKS                                              *
 ************************************************************************************************ */

const applySubstitutions1 = (input: string, substitutions: Record<string, unknown> = {}): string =>
  input.replace(/{{(.*?)}}/g, (match, key: string) =>
    key in substitutions ? String(substitutions[key]) : match,
  );

const applySubstitutions2 = (
  input: string,
  substitutions: Record<string, unknown> = {},
): string => {
  let result = '';
  let i = 0;

  while (i < input.length) {
    const start = input.indexOf('{{', i);

    if (start === -1) {
      result += input.slice(i);
      break;
    }

    result += input.slice(i, start);

    const end = input.indexOf('}}', start + 2);

    if (end === -1) {
      result += input.slice(start);
      break;
    }

    const key = input.slice(start + 2, end);
    result += key in substitutions ? String(substitutions[key]) : input.slice(start, end + 2);

    i = end + 2;
  }

  return result;
};

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

test('applySubstitutions', async ({ bench }) => {
  await bench.compare(
    bench('using applySubstitutions1', () => {
      applySubstitutions1(MOCK_STR, SUBSTITUTIONS);
    }),
    bench('using applySubstitutions2', () => {
      applySubstitutions2(MOCK_STR, SUBSTITUTIONS);
    }),
  );
});
