// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import type { IDateTemplate, ITimeString } from './types.js';
import { DATE_LOCALE, DATE_TEMPLATES_WITH_TIME } from './constants.js';
import { createTimestamp, prettifyDate, prettifyTime, toDate, toMS, toUtcDate } from './date.js';

describe('toDate', () => {
  test.each(<Array<[number | string | Date]>>[
    [1733412835329],
    ['2024-12-05T15:33:55.329Z'],
    [new Date(1733412835329)],
  ])('toDate(%s) -> valid Date', (a) => {
    const instance = toDate(a);
    expect(instance).toBeInstanceOf(Date);
    expect(instance.getTime()).toBe(1733412835329);
  });
});

describe('prettifyDate', () => {
  test('uses date-short when no template is provided', () => {
    const value = new Date(2024, 11, 5, 12);

    expect(prettifyDate(value)).toBe(prettifyDate(value, 'date-short'));
  });

  test.each(<Array<[IDateTemplate]>>[
    ['date-short'],
    ['date-medium'],
    ['date-long'],
    ['time-short'],
    ['time-medium'],
    ['datetime-short'],
    ['datetime-medium'],
    ['datetime-long'],
  ])('prettifyDate(%s) -> valid string', (template) => {
    const res = prettifyDate(Date.now(), template);
    expect(res).toBeTypeOf('string');
    expect(res.length).toBeGreaterThan(0);
  });

  // ICU separates the time from AM/PM with a narrow no-break space in recent versions
  const normalizeSpaces = (value: string): string => value.replace(/\s/g, ' ');
  const INSTANT = '2026-10-16T21:08:05Z';

  test.each(<Array<[IDateTemplate, string]>>[
    ['date-short', '10/16/2026'],
    ['date-medium', 'October 16, 2026'],
    ['date-long', 'Friday, October 16, 2026'],
    ['time-short', '9:08 PM UTC'],
    ['time-medium', '9:08:05 PM UTC'],
    ['datetime-short', '10/16/2026, 9:08 PM UTC'],
    ['datetime-medium', 'October 16, 2026 at 9:08 PM UTC'],
    ['datetime-long', 'Friday, October 16, 2026 at 9:08:05 PM UTC'],
  ])("prettifyDate(instant, %s, 'UTC') -> %s", (template, expected) => {
    expect(normalizeSpaces(prettifyDate(INSTANT, template, 'UTC'))).toBe(expected);
  });

  test('formats calendar days in the provided time zone', () => {
    const instant = '2024-12-05T23:30:00Z';

    expect(prettifyDate(instant, 'date-medium', 'UTC')).toBe('December 5, 2024');
    expect(prettifyDate(instant, 'date-medium', 'Asia/Tokyo')).toBe('December 6, 2024');
    expect(normalizeSpaces(prettifyDate(instant, 'datetime-medium', 'Asia/Tokyo'))).toBe(
      'December 6, 2024 at 8:30 AM GMT+9',
    );
  });

  test('labels only the templates that include a time', () => {
    const templates = <IDateTemplate[]>[
      'date-short',
      'date-medium',
      'date-long',
      'time-short',
      'time-medium',
      'datetime-short',
      'datetime-medium',
      'datetime-long',
    ];
    templates.forEach((template) => {
      expect(prettifyDate(INSTANT, template, 'UTC').endsWith('UTC')).toBe(
        DATE_TEMPLATES_WITH_TIME.includes(template),
      );
    });
  });

  test('throws a RangeError for an unknown time zone', () => {
    expect(() => prettifyDate(INSTANT, 'datetime-medium', 'Mars/Olympus_Mons')).toThrow(RangeError);
  });

  describe('locale', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test.each(
      (<IDateTemplate[]>[
        'date-short',
        'date-medium',
        'date-long',
        'time-short',
        'time-medium',
        'datetime-short',
        'datetime-medium',
        'datetime-long',
      ]).flatMap((template): Array<[IDateTemplate, string | undefined]> => [
        [template, undefined],
        [template, 'UTC'],
      ]),
    )('prettifyDate(instant, %s, %s) requests the en-US locale', (template, timeZone) => {
      const spy = vi.spyOn(Date.prototype, 'toLocaleString');

      prettifyDate(INSTANT, template, timeZone);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]?.[0]).toBe(DATE_LOCALE);
    });
  });
});

describe('prettifyTime', () => {
  test.each(<Array<[number, string]>>[
    [0, '0s'],
    [999, '0s'],
    [1000, '1s'],
    [59_999, '59s'],
    [60_000, '1m'],
    [61_999, '1m'],
    [3_600_000, '1h'],
    [3_660_000, '1h 1m'],
    [86_400_000, '1d'],
    [90_000_000, '1d 1h'],
    [90_060_000, '1d 1h 1m'],
  ])('prettifyTime(%d) -> %s', (milliseconds, expected) => {
    expect(prettifyTime(milliseconds)).toBe(expected);
  });

  test.each(<Array<[number, string]>>[
    [-1, '0s'],
    [Number.NaN, '0s'],
    [Number.POSITIVE_INFINITY, '0s'],
  ])('prettifyTime(%d) -> safe fallback %s', (milliseconds, expected) => {
    expect(prettifyTime(milliseconds)).toBe(expected);
  });
});

describe('toMS', () => {
  test.each<[ITimeString, number]>([
    ['1 millisecond', 1],
    ['100 millisecond', 100],
    ['100 milliseconds', 100],
    ['1 second', 1000],
    ['10 second', 10000],
    ['10 seconds', 10000],
    ['1 minute', 60000],
    ['10 minute', 600000],
    ['10 minutes', 600000],
    ['1 hour', 3600000],
    ['10 hour', 36000000],
    ['10 hours', 36000000],
    ['1 day', 86400000],
    ['10 day', 864000000],
    ['10 days', 864000000],
    ['1 week', 604800000],
    ['10 week', 6048000000],
    ['10 weeks', 6048000000],
    ['1 month', 2629800000],
    ['10 month', 26298000000],
    ['10 months', 26298000000],
    ['1 year', 31557600000],
    ['10 year', 315576000000],
    ['10 years', 315576000000],
    ['53 years', 1672552800000],
    ['53 months', 139379400000],
    ['53 weeks', 32054400000],
    ['53 days', 4579200000],
    ['53 hours', 190800000],
    ['53 minutes', 3180000],
    ['53 seconds', 53000],
    ['53 milliseconds', 53],
  ])('toMS(%s) -> %i', (input, expected) => {
    expect(toMS(input)).toBe(expected);
  });

  test.each([
    '',
    '100',
    '1x',
    '1hour',
    '2dys',
    '3week',
    '1second',
    '100milliseconds',
    '1monthss',
    '1yearz',
    '1.5hr',
    '1   s   ',
    '.5 msec',
    '-100 ms',
    '-1.5 hr',
    '-10.5 h',
    '-.5 h',
    '53 millisecondss',
    '17 msecs ',
    '1 sec ',
    '1 min ',
    '1 hr ',
    '2 days ',
    '1 week ',
    ' 1 day',
    '1 day ',
    ' 1 day ',
    '53 YeArS',
    '53 WeEkS',
    '53 DaYS',
    '53 HoUrs',
    '53 MiLliSeCondS',
    '0 day',
    '0 days',
    '-2 days',
    '2.1 days',
    '0.5 years',
    '2  days',
  ])('toMS(%s) -> throws', (input) => {
    expectToThrowCode(() => toMS(input as ITimeString), ERRORS.INVALID_TIME_STRING);
  });
});

describe('createTimestamp', () => {
  test.each([
    [new Date(Date.UTC(2026, 9, 17, 8, 30)), '2026-10-17T08:30:00.000Z'],
    [0, '1970-01-01T00:00:00.000Z'],
    [Date.UTC(2026, 0, 1), '2026-01-01T00:00:00.000Z'],
    ['2026-10-17T10:30:00+02:00', '2026-10-17T08:30:00.000Z'],
  ])('createTimestamp(%o) -> %s', (value, expected) => {
    expect(createTimestamp(value)).toBe(expected);
  });

  test('uses the current time without a value', () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 17, 8, 30) });

    expect(createTimestamp()).toBe('2026-10-17T08:30:00.000Z');

    vi.useRealTimers();
  });

  test.each([['not a date'], [Number.NaN]])('createTimestamp(%o) -> throws', (value) => {
    expect(() => createTimestamp(value)).toThrow(RangeError);
  });
});

describe('toUtcDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    ['2026-10-17T23:30:00.000-05:00', '2026-10-18'],
    ['2026-10-18T00:30:00.000+05:00', '2026-10-17'],
    ['2026-10-17T00:00:00.000Z', '2026-10-17'],
    ['2026-10-17T23:59:59.999Z', '2026-10-17'],
    [0, '1970-01-01'],
    [-1, '1969-12-31'],
    [Date.UTC(2028, 1, 29, 12), '2028-02-29'],
    [new Date('0000-01-01T00:00:00.000Z'), '0000-01-01'],
    [new Date('9999-12-31T23:59:59.999Z'), '9999-12-31'],
  ])('toUtcDate(%o) -> %s', (value, expected) => {
    expect(toUtcDate(value)).toBe(expected);
  });

  test("uses the current time's UTC date by default", () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-17T23:59:59.000Z') });

    expect(toUtcDate()).toBe('2026-10-17');
  });

  test.each([
    ['not a date'],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [new Date(Number.NaN)],
    [Date.parse('0000-01-01T00:00:00.000Z') - 1],
    [Date.parse('9999-12-31T23:59:59.999Z') + 1],
  ])('toUtcDate(%o) -> throws INVALID_DATE', (value) => {
    expectToThrowCode(() => toUtcDate(value), ERRORS.INVALID_DATE);
  });
});
