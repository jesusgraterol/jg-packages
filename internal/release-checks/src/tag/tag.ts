import { TAGGER_EMAIL, TAGGER_NAME } from '../shared/constants.ts';
import { readPublishedEntries, readReleaseManifest } from '../shared/release-files.ts';
import type { ICommandResult, IPublishedEntry } from '../shared/types.ts';

/*
 * This module runs in the CI job that pushes tags, which installs no dependencies, so it and
 * everything it imports use only Node.js built-ins. A unit test enforces it.
 */

// what the tag command needs from its environment
export type ITagDependencies = {
  runGit: (args: string[]) => Promise<ICommandResult>;
  log: (message: string) => void;
};

/**
 * Builds a release tag's name, so each package keeps its own release history.
 * @param entry The published version.
 * @returns The tag name, such as `jg-toolkit-v1.2.0`.
 */
export const toTagName = ({ name, version }: IPublishedEntry): string => `${name}-v${version}`;

/**
 * Runs git and fails on a non-zero exit code.
 * @param runGit Runs git.
 * @param args The git arguments.
 * @returns A promise that resolves to standard output.
 * @throws
 * - git {args} failed: {stderr}
 */
const git = async (runGit: ITagDependencies['runGit'], args: string[]): Promise<string> => {
  const result = await runGit(args);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
};

/**
 * The `tag` command: creates and pushes an annotated `<name>-v<version>` tag on the current
 * commit for every version the publish run put on npm, skipping tags `origin` already has. Tags
 * are created as `github-actions[bot]`, because GitHub runners configure no git identity.
 * @param releaseDirectory The release directory, whose manifest lists the release's packages.
 * @param publishedFile The `published.json` the publish run wrote.
 * @param dependencies The git runner and logger.
 * @returns A promise that resolves to the tags this run pushed.
 * @throws
 * - The release manifest is not a list of tarball entries: {path}
 * - The published file is not a list of package versions: {path}
 * - The published version isn't part of the release: {name}@{version}
 * - git {args} failed: {stderr}
 */
export const tagRelease = async (
  releaseDirectory: string,
  publishedFile: string,
  { runGit, log }: ITagDependencies,
): Promise<string[]> => {
  const release = await readReleaseManifest(releaseDirectory);
  const published = await readPublishedEntries(publishedFile);
  const pushed: string[] = [];
  for (const entry of published) {
    if (!release.some(({ name, version }) => name === entry.name && version === entry.version)) {
      throw new Error(
        `The published version isn't part of the release: ${entry.name}@${entry.version}`,
      );
    }
    const tag = toTagName(entry);
    if ((await git(runGit, ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])).trim() !== '') {
      log(`Skipped ${tag}: origin already has it`);
      continue;
    }
    const hasLocalTag =
      (await runGit(['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`])).exitCode === 0;
    if (!hasLocalTag) {
      await git(runGit, [
        '-c',
        `user.name=${TAGGER_NAME}`,
        '-c',
        `user.email=${TAGGER_EMAIL}`,
        'tag',
        '--annotate',
        tag,
        '--message',
        `${entry.name} ${entry.version}`,
      ]);
    }
    await git(runGit, ['push', '--no-follow-tags', 'origin', `refs/tags/${tag}`]);
    log(`Pushed ${tag}`);
    pushed.push(tag);
  }
  return pushed;
};
