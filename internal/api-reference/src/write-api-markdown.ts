import { writeApiMarkdown } from './api-markdown-file.ts';

/*
 * The last step of every package's build: writes API.md, the package's API reference as Markdown,
 * so its tarball ships version-matched docs. Package scripts run it as
 * `node ../../internal/api-reference/src/write-api-markdown.ts`, so the working directory is the
 * package.
 */
try {
  console.log(`Wrote ${await writeApiMarkdown(process.cwd())}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
