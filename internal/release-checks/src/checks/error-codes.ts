import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import ts from 'typescript';

import type { IRunCommand } from '../shared/types.ts';
import type { IConsumerProject } from './consumer-project.ts';
import { toSpecifier } from './install-import.ts';
import { getImportableSubpaths } from './subpaths.ts';
import type { IPackedPackage } from './types.ts';

// the assertion helpers whose second argument is the expected code
const CODE_ASSERTIONS = new Set(['expectToThrowCode', 'expectToRejectCode', 'hasErrorCode']);

// the properties that hold a code in an error, as a matcher compares them
const CODE_PROPERTIES = new Set(['code', 'kind']);

// prints an entry point's ERRORS as JSON, with the specifier passed as an argument
const READ_ERRORS_SCRIPT =
  'const { ERRORS } = await import(process.argv[1]); console.log(JSON.stringify(ERRORS ?? null));';

/**
 * Reads the name of a call's callee, such as `toMatchObject` in `expect(x).toMatchObject(y)`.
 * @param call The call.
 * @returns The name, or undefined for a callee without one.
 */
const getCalleeName = (call: ts.CallExpression): string | undefined => {
  const { expression } = call;
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
};

/**
 * Finds the `expect(…)` call a matcher hangs off, such as in `expect(x).rejects.toMatchObject(y)`.
 * @param node The matcher's receiver.
 * @returns The expect call, or undefined when the receiver isn't one.
 */
const findExpectCall = (node: ts.Expression): ts.CallExpression | undefined => {
  if (ts.isPropertyAccessExpression(node)) {
    return findExpectCall(node.expression);
  }
  if (ts.isCallExpression(node)) {
    const { expression } = node;
    if (ts.isIdentifier(expression) && expression.text === 'expect') {
      return node;
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      return expression.expression.text === 'expect' ? node : undefined;
    }
  }
  return undefined;
};

/**
 * Reads the code a node names: `ERRORS.KEY`, or a string literal.
 * @param node The node.
 * @param codes Each ERRORS key with its code.
 * @returns The code, or undefined when the node names none.
 */
const readCode = (node: ts.Node, codes: ReadonlyMap<string, string>): string | undefined => {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'ERRORS'
  ) {
    return codes.get(node.name.text);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [...codes.values()].includes(node.text) ? node.text : undefined;
  }
  return undefined;
};

/**
 * Collects the codes in `code` and `kind` properties anywhere inside a matcher's argument, such as
 * `{ code: ERRORS.X }` or `expect.objectContaining({ kind: 'TIMEOUT' })`.
 * @param node The argument.
 * @param codes Each ERRORS key with its code.
 * @param found The codes found so far.
 */
const collectPropertyCodes = (
  node: ts.Node,
  codes: ReadonlyMap<string, string>,
  found: Set<string>,
): void => {
  if (
    ts.isPropertyAssignment(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    CODE_PROPERTIES.has(node.name.text)
  ) {
    const code = readCode(node.initializer, codes);
    if (code !== undefined) {
      found.add(code);
    }
  }
  ts.forEachChild(node, (child) => collectPropertyCodes(child, codes, found));
};

/**
 * Finds the codes a test file asserts. A code counts only inside an assertion:
 * - the code argument of expectToThrowCode, expectToRejectCode, or hasErrorCode
 * - a `code` or `kind` property anywhere inside the arguments of an `expect(…)` matcher
 * - a matcher's argument when `expect` received an error's `code` or `kind`
 *
 * Comments, constants, and test tables never count.
 * @param source The test file's text.
 * @param codes Each ERRORS key with its code.
 * @returns The codes the file asserts.
 */
export const findAssertedCodes = (
  source: string,
  codes: ReadonlyMap<string, string>,
): Set<string> => {
  const file = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = getCalleeName(node);
      const codeArgument = node.arguments[1];
      if (name !== undefined && CODE_ASSERTIONS.has(name) && codeArgument !== undefined) {
        const code = readCode(codeArgument, codes);
        if (code !== undefined) {
          found.add(code);
        }
      }
      const expectCall = ts.isPropertyAccessExpression(node.expression)
        ? findExpectCall(node.expression.expression)
        : undefined;
      if (expectCall !== undefined) {
        for (const argument of node.arguments) {
          collectPropertyCodes(argument, codes, found);
        }
        const [subject] = expectCall.arguments;
        if (
          subject !== undefined &&
          ts.isPropertyAccessExpression(subject) &&
          CODE_PROPERTIES.has(subject.name.text)
        ) {
          for (const argument of node.arguments) {
            const code = readCode(argument, codes);
            if (code !== undefined) {
              found.add(code);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

/**
 * Lists a package's test files: every `.test-*.ts` under `src`, end-to-end tests included, besides
 * shared test utilities and benchmarks.
 * @param directory The package directory.
 * @returns A promise that resolves to the files' paths.
 */
const listTestFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(join(directory, 'src'), { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.test-[a-z0-9]+\.ts$/.test(entry.name) &&
        !/\.test-(?:utils|bench)\.ts$/.test(entry.name),
    )
    .map((entry) => join(entry.parentPath, entry.name));
};

/**
 * Reads the codes every entry point of an installed package exports as ERRORS.
 * @param packed The package.
 * @param runCommand Runs a command.
 * @param consumerDirectory The project the package is installed in.
 * @returns A promise that resolves to each key with its code, empty without ERRORS.
 */
const readErrorCodes = async (
  packed: IPackedPackage,
  runCommand: IRunCommand,
  consumerDirectory: string,
): Promise<Map<string, string>> => {
  const { name, exports: exportsMap } = packed.packedManifest;
  const codes = new Map<string, string>();
  for (const subpath of getImportableSubpaths(exportsMap)) {
    const result = await runCommand(
      process.execPath,
      ['--input-type=module', '--eval', READ_ERRORS_SCRIPT, toSpecifier(name, subpath)],
      { cwd: consumerDirectory },
    );
    const errors = result.exitCode === 0 ? (JSON.parse(result.stdout) as unknown) : null;
    if (typeof errors === 'object' && errors !== null) {
      for (const [key, code] of Object.entries(errors)) {
        if (typeof code === 'string') {
          codes.set(key, code);
        }
      }
    }
  }
  return codes;
};

/**
 * Check 9: every code a package exports as ERRORS is asserted in at least one of its test files,
 * as `ERRORS.<KEY>` or as the code itself, inside an assertion. It proves each code is asserted
 * somewhere, not that every path producing it is tested.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @param consumer The project the tarballs are installed in.
 * @returns A promise that resolves to each package's problems, by name.
 */
export const checkErrorCodes = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
  consumer: IConsumerProject,
): Promise<Map<string, string[]>> => {
  const problems = new Map<string, string[]>();
  // check 2 reports a failed install
  if (consumer.installProblem !== undefined) {
    return problems;
  }
  for (const packed of packages) {
    const codes = await readErrorCodes(packed, runCommand, consumer.directory);
    if (codes.size === 0) {
      continue;
    }
    const asserted = new Set<string>();
    for (const file of await listTestFiles(packed.workspacePackage.directory)) {
      for (const code of findAssertedCodes(await readFile(file, 'utf8'), codes)) {
        asserted.add(code);
      }
    }
    problems.set(
      packed.packedManifest.name,
      [...codes]
        .filter(([, code]) => !asserted.has(code))
        .map(([key, code]) => `ERRORS.${key} ('${code}') is never asserted in a test`),
    );
  }
  return problems;
};
