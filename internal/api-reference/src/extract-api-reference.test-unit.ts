import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

import { extractApiReference } from './extract-api-reference.ts';
import type { IApiReference, IApiSymbol } from './types.ts';

const FIXTURES_DIRECTORY = join(import.meta.dirname, 'fixtures');

let reference: IApiReference;

// finds a symbol of the fixture's root entry point by name
const getSymbol = (name: string): IApiSymbol => {
  const symbol = reference.entryPoints[0]?.symbols.find((candidate) => candidate.name === name);
  if (symbol === undefined) {
    throw new Error(`The fixture doesn't export ${name}.`);
  }
  return symbol;
};

beforeAll(async () => {
  reference = await extractApiReference(join(FIXTURES_DIRECTORY, 'sample-package'));
});

describe('extractApiReference', () => {
  test('documents every TypeScript entry point and skips the others', () => {
    expect(reference.packageName).toBe('sample-package');
    expect(reference.version).toBe('1.0.0');
    expect(reference.entryPoints.map(({ subpath }) => subpath)).toStrictEqual(['.', './extra']);
    expect(reference.entryPoints[1]?.symbols.map(({ name }) => name)).toStrictEqual(['double']);
  });

  test('describes a function signature with its parameters, returns, throws, and example', () => {
    expect(getSymbol('movePoint')).toStrictEqual({
      name: 'movePoint',
      kind: 'function',
      summary: 'Moves a point by an offset.',
      examples: ['```ts\nmovePoint({ x: 1, y: 2 }, 3); // { x: 4, y: 5 }\n```'],
      deprecated: undefined,
      type: undefined,
      members: [],
      signatures: [
        {
          text: 'movePoint(point: IPoint, offset?: number): IPoint',
          summary: 'Moves a point by an offset.',
          typeParameters: [],
          parameters: [
            {
              name: 'point',
              type: 'IPoint',
              isOptional: false,
              isRest: false,
              defaultValue: undefined,
              description: 'The point to move.',
            },
            {
              name: 'offset',
              type: 'number',
              isOptional: true,
              isRest: false,
              defaultValue: '1',
              description: 'The distance to add to both coordinates.',
            },
          ],
          returnType: 'IPoint',
          returns: 'The moved point.',
          throws: ['INVALID_POINT: The point is not valid.'],
          examples: ['```ts\nmovePoint({ x: 1, y: 2 }, 3); // { x: 4, y: 5 }\n```'],
          deprecated: undefined,
        },
      ],
    });
  });

  test('keeps every overload, each with its own documentation and deprecation', () => {
    const formatPoint = getSymbol('formatPoint');

    expect(
      formatPoint.signatures.map(({ text, summary, deprecated }) => ({
        text,
        summary,
        deprecated,
      })),
    ).toStrictEqual([
      {
        text: 'formatPoint(point: IPoint): string',
        summary: 'Formats a point.',
        deprecated: 'Use `describePoint` instead.',
      },
      {
        text: 'formatPoint(point: IPoint, prefix: string): string',
        summary: 'Formats a point with a prefix.',
        deprecated: undefined,
      },
    ]);
    expect(formatPoint.deprecated).toBe('Use `describePoint` instead.');
  });

  test('reads line comments on types, constants, and properties', () => {
    const point = getSymbol('IPoint');

    expect(point.summary).toBe('a two-dimensional point');
    expect(point.type).toBe('type IPoint = {\n    x: number;\n    y: number;\n};');
    expect(point.members.map(({ name, summary, type }) => ({ name, summary, type }))).toStrictEqual(
      [
        { name: 'x', summary: 'horizontal position', type: 'number' },
        { name: 'y', summary: '', type: 'number' },
      ],
    );
    expect(getSymbol('ERRORS')).toMatchObject({
      kind: 'constant',
      summary: 'error codes the sample package throws',
      type: '{ INVALID_POINT: "The point is not valid." }',
    });
  });

  test('describes a class with its example, constructor, and public members', () => {
    const shape = getSymbol('Shape');

    expect(shape.summary).toBe('A polygon with a fixed number of sides.');
    expect(shape.examples).toStrictEqual(['```ts\nnew Shape(3).sides; // 3\n```']);
    expect(
      shape.members.map(({ name, kind, signatures }) => [
        name,
        kind,
        signatures.map(({ text }) => text),
      ]),
    ).toStrictEqual([
      ['sides', 'property', []],
      ['constructor', 'constructor', ['new Shape(sides: number)']],
      ['isTriangle', 'method', ['isTriangle(): boolean']],
    ]);
  });

  test("never credits a symbol with the index file's section comment", () => {
    expect(getSymbol('IUndocumentedShape').summary).toBe('');
    expect(getSymbol('UNDOCUMENTED_LIMIT').summary).toBe('');
    expect(getSymbol('UndocumentedShape').summary).toBe('');
    expect(getSymbol('undocumentedDistance').signatures[0]?.summary).toBe('');
  });

  test('fails when an exports target has no source', async () => {
    await expect(extractApiReference(join(FIXTURES_DIRECTORY, 'missing-source'))).rejects.toThrow(
      "The source of an exports target doesn't exist",
    );
  });
});
