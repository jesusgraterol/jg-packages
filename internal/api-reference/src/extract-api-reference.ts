import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Application,
  Converter,
  type DeclarationReflection,
  normalizePath,
  type ProjectReflection,
  ReflectionKind,
} from 'typedoc';

import { getDeclarationFacts } from './declarations.ts';
import {
  getSourceEntryPoints,
  readPackageManifest,
  type ISourceEntryPoint,
} from './entry-points.ts';
import { toApiSymbol, type IDeclarationFactsById } from './reflections.ts';
import type { IApiEntryPoint, IApiReference } from './types.ts';

/**
 * Picks the configuration TypeDoc compiles with: the package's build configuration when it has
 * one, so tests are left out, and otherwise its `tsconfig.json`.
 * @param packageDirectory The package directory.
 * @returns A promise that resolves to the configuration's path.
 */
const getTsconfigPath = async (packageDirectory: string): Promise<string> => {
  const buildConfig = join(packageDirectory, 'tsconfig.build.json');
  try {
    await access(buildConfig);
    return buildConfig;
  } catch {
    return join(packageDirectory, 'tsconfig.json');
  }
};

/**
 * Pairs each entry point with the reflections it exports. TypeDoc puts a single entry point's
 * symbols directly on the project, and wraps several in one module each.
 * @param project The converted project.
 * @param entryPoints The entry points TypeDoc converted.
 * @returns Each entry point with its top-level reflections.
 * @throws
 * - TypeDoc produced no module for the entry point: {sourceFile}
 */
const groupByEntryPoint = (
  project: ProjectReflection,
  entryPoints: ISourceEntryPoint[],
): { subpath: string; reflections: DeclarationReflection[] }[] => {
  const [onlyEntryPoint] = entryPoints;
  if (entryPoints.length === 1 && onlyEntryPoint !== undefined) {
    return [{ subpath: onlyEntryPoint.subpath, reflections: project.children ?? [] }];
  }
  return entryPoints.map(({ subpath, sourceFile }) => {
    const module = (project.children ?? []).find(
      (child) =>
        child.kind === ReflectionKind.Module &&
        child.sources?.some(
          (source) => normalizePath(source.fullFileName) === normalizePath(sourceFile),
        ),
    );
    if (module === undefined) {
      throw new Error(`TypeDoc produced no module for the entry point: ${sourceFile}`);
    }
    return { subpath, reflections: module.children ?? [] };
  });
};

/**
 * Follows a re-export reference, such as a symbol two entry points both export, to the
 * reflection that declares it.
 * @param reflection A top-level reflection.
 * @returns The declaring reflection.
 */
const resolveReference = (reflection: DeclarationReflection): DeclarationReflection => {
  if (reflection.isReference()) {
    const target = reflection.getTargetReflectionDeep();
    if (target.isDeclaration()) {
      return target;
    }
  }
  return reflection;
};

/**
 * Extracts a package's public API with TypeDoc: every symbol each `exports` subpath exposes, with
 * its signatures, types, and TSDoc. Entry points come from the manifest, so `./dist/*.js` targets
 * map back to their `./src/*.ts` sources.
 * @param packageDirectory The package directory, holding its `package.json` and `tsconfig.json`.
 * @returns A promise that resolves to the package's API reference.
 * @example
 * const reference = await extractApiReference('/repo/packages/jg-utilities');
 * reference.entryPoints[0].symbols.map(({ name }) => name);
 * @throws
 * - The package has no name, version, or exports map: {packageDirectory}
 * - The exports target points outside the package: {subpath}
 * - The source of an exports target doesn't exist: {sourceFile}
 * - TypeDoc could not convert the package: {packageDirectory}
 * - TypeDoc produced no module for the entry point: {sourceFile}
 */
export const extractApiReference = async (packageDirectory: string): Promise<IApiReference> => {
  const manifest = await readPackageManifest(packageDirectory);
  const entryPoints = await getSourceEntryPoints(packageDirectory, manifest.exports);
  if (entryPoints.length === 0) {
    return { packageName: manifest.name, version: manifest.version, entryPoints: [] };
  }

  const app = await Application.bootstrap({
    name: manifest.name,
    // TypeDoc reads entry points as globs, which can't hold Windows's `\` separators
    entryPoints: entryPoints.map(({ sourceFile }) => normalizePath(sourceFile)),
    tsconfig: await getTsconfigPath(packageDirectory),
    // the repository documents types and constants with `//` comments, so read every comment style
    commentStyle: 'all',
    excludeExternals: true,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    readme: 'none',
    sort: ['source-order'],
    logLevel: 'Error',
  });
  const factsById: IDeclarationFactsById = new Map();
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (context, reflection) => {
    const symbol = context.getSymbolFromReflection(reflection);
    if (symbol !== undefined) {
      factsById.set(reflection.id, getDeclarationFacts(symbol, context.checker));
    }
  });
  const project = await app.convert();
  if (project === undefined) {
    throw new Error(`TypeDoc could not convert the package: ${packageDirectory}`);
  }

  const apiEntryPoints: IApiEntryPoint[] = groupByEntryPoint(project, entryPoints).map(
    ({ subpath, reflections }) => ({
      subpath,
      symbols: reflections.flatMap((reflection) => {
        const declaration = resolveReference(reflection);
        const symbol = toApiSymbol(declaration, factsById.get(declaration.id));
        return symbol === undefined ? [] : [{ ...symbol, name: reflection.name }];
      }),
    }),
  );
  return { packageName: manifest.name, version: manifest.version, entryPoints: apiEntryPoints };
};
