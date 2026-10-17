import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { publishRelease } from './publish/publish.ts';
import { runCommand } from './shared/run-command.ts';
import { tagRelease } from './tag/tag.ts';

/*
 * The release command-line tool: `verify`, `pack --out <dir>`, `publish --from <dir>`, and
 * `tag --from <dir> --published <file>`. Its static imports use only Node.js built-ins, because
 * the publish and tag jobs install nothing; `verify` and `pack` load their checks dynamically.
 */

const USAGE = [
  'Usage: node internal/release-checks/src/cli.ts <command>',
  '  verify                              pack and check every publishable package',
  '  pack --out <dir>                    pack and check, keeping the tarballs and manifest',
  '  publish --from <dir>                publish a packed release',
  '  tag --from <dir> --published <file> tag the versions a publish run put on npm',
].join('\n');

// the repository root, three levels above this file
const ROOT_DIRECTORY = resolve(import.meta.dirname, '..', '..', '..');

/**
 * Reads a required option of a command.
 * @param values The parsed options.
 * @param name The option name.
 * @returns The option's value.
 * @throws
 * - Missing --{name}.
 */
const requireOption = (values: Record<string, unknown>, name: string): string => {
  const value = values[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing --${name}.\n${USAGE}`);
  }
  return value;
};

/**
 * Runs the command the arguments name.
 * @param args The command-line arguments after the script.
 * @returns A promise that resolves to the exit code.
 * @throws
 * - The release commands run on Linux and macOS.
 * - Unknown command: {command}
 */
const main = async (args: string[]): Promise<number> => {
  if (process.platform === 'win32') {
    throw new Error('The release commands run on Linux and macOS.');
  }
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: { out: { type: 'string' }, from: { type: 'string' }, published: { type: 'string' } },
  });
  const [command, ...extra] = positionals;
  const log = (message: string): void => console.log(message);
  if (extra.length > 0) {
    throw new Error(`Unexpected arguments: ${extra.join(' ')}\n${USAGE}`);
  }
  switch (command) {
    case 'verify':
    case 'pack': {
      const [{ runPack, runVerify }, { createNpmRegistry }] = await Promise.all([
        import('./verify/verify.ts'),
        import('./registry/npm-registry.ts'),
      ]);
      const dependencies = { registry: createNpmRegistry(runCommand), runCommand, log };
      return command === 'verify'
        ? runVerify(ROOT_DIRECTORY, dependencies)
        : runPack(ROOT_DIRECTORY, resolve(requireOption(values, 'out')), dependencies);
    }
    case 'publish':
      await publishRelease(resolve(requireOption(values, 'from')), {
        runNpm: (npmArgs) => runCommand('npm', npmArgs),
        sleep: (milliseconds) => sleep(milliseconds),
        log,
      });
      return 0;
    case 'tag':
      await tagRelease(
        resolve(requireOption(values, 'from')),
        resolve(requireOption(values, 'published')),
        {
          runGit: (gitArgs) => runCommand('git', gitArgs),
          log,
        },
      );
      return 0;
    default:
      throw new Error(`Unknown command: ${command ?? '(none)'}\n${USAGE}`);
  }
};

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
