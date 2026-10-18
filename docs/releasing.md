# Releasing

How versions are chosen, checked, published, and tagged. Releases are cut from `main`: CI packs every package, publishes the versions npm doesn't have yet, and tags them. You never run `npm publish` by hand except for a package's first version.

## Versions

Packages follow semantic versioning:

| Change                                                                                      | Version         |
| ------------------------------------------------------------------------------------------- | --------------- |
| Removing or renaming an export, narrowing a type or option, or changing documented behavior | major (`2.0.0`) |
| Adding an export, an option, or a subpath                                                   | minor (`1.1.0`) |
| A fix that keeps the documented behavior                                                    | patch (`1.0.1`) |

- Deprecate in a minor release before removing in a major one: mark the symbol `@deprecated` in its TSDoc and list it under `### Deprecated` in the changelog.
- In `0.x` versions, a minor bump may break the API and a patch never does.
- One exception happened once: the eight `1.x` packages released `1.1.0` with breaking changes, a fresh start while nothing depended on `1.0.x`, and each changelog says so. `jg-fetch` started over in `0.2.0` at the same time. Every version below `1.1.0`, and below `0.2.0` for `jg-fetch`, is deprecated, because it doesn't work with the others, as described in [Deprecating a version](#deprecating-a-version). Every breaking change after it is a major version.
- A package needs a release only when the files it ships changed. `release:verify` decides that from the packed tarball, not from the diff, so a change to tests, `devDependencies`, or scripts needs no release.

## Releasing a version

1. Bump `version` in the package's `package.json`, and add a `## <version>` section at the top of its `CHANGELOG.md`, with `### Added`, `### Changed`, `### Deprecated`, `### Removed`, or `### Fixed` subsections as needed.
2. Update the README when the change affects what it documents. The README is the package's npm page for that version.
3. Run every check:

   ```bash
   pnpm check
   ```

   Expected result: `release:verify` prints `PASS <name>@<version>` for every package.

4. Check whether the change affects jg-skills' guidance, as [Keeping jg-skills in sync](package-guidelines.md#keeping-jg-skills-in-sync) describes, and record its matching change or why none is needed.
5. Commit on `development`, open a pull request to `main`, and merge it once CI passes. CI publishes the new version and pushes its `<name>-v<version>` tag.

### Releasing with a sibling it needs

`workspace:^` packs as `^<the sibling's current version>`. When a package starts using something a sibling added in a new version, release both in the same pull request. CI publishes in dependency order, so the sibling reaches npm first, and the dependent never ships ahead of it.

### Prereleases

A version with a prerelease part, such as `1.2.0-beta.0`, is published under the `next` dist-tag, so `npm install <name>` keeps getting the latest stable version. A fix for an older major version is released by hand from a branch, with its own dist-tag, such as `npm publish <file> --tag v1`.

## What `release:verify` checks

`pnpm release:verify` packs every package under `packages/` that isn't private, checks the tarballs, and removes them. `pnpm release:pack` runs the same checks and keeps the tarballs in `.release/`, with a `release-manifest.json` that lists each one in publish order with its SHA-256.

Before packing, it runs the workspace check once: every workspace `pnpm-workspace.yaml` lists, private ones included, that has a `test:unit` or `test:integration` script must also have `test:coverage`, because that's how `pnpm check` runs its tests. A missing one prints `FAIL workspaces` with the workspace's name. It reads the manifests directly, outside Turborepo, so a cached task can never hide a suite that dropped out.

| Check              | Fails when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File list          | the tarball ships something outside `files` (besides `package.json`, `README.md`, `LICENSE`, and `CHANGELOG.md`), a test or `.tsbuildinfo` file, or is missing an `exports` or `bin` target                                                                                                                                                                                                                                                                                                                             |
| Install and import | the tarballs can't be installed together into a temporary project, an installed manifest still has a `workspace:` or `catalog:` range, a subpath can't be imported by name, a private path can be imported, or an installed command fails `--help`                                                                                                                                                                                                                                                                      |
| Examples           | an `@example`, or a ` ```ts ` block of `RECIPES.md`, doesn't typecheck against the installed tarballs, with the package's `examples.d.ts`; or, in `jg-exception`, `jg-api-response`, `jg-utilities`, and `jg-bignumber`, an example throws when it runs, in en-US and UTC, or a stated `// =>` result doesn't hold. Recipes are typechecked only, because they show app code that does I/O. Packages with Astro components are skipped                                                                                  |
| Error codes        | a code the package exports as `ERRORS` is asserted in none of its test files. Only assertions count, parsed with the TypeScript compiler: the code argument of `expectToThrowCode`, `expectToRejectCode`, or `hasErrorCode`; a `code` or `kind` property inside an `expect(…)` matcher's arguments; or a matcher's argument when `expect` received an error's `code` or `kind`. Comments, constants, and test tables don't count. It proves each code is asserted somewhere, not that every path producing it is tested |
| Astro fixture      | only for packages with Astro components: the tarball, with `astro`, `tailwindcss`, and `@tailwindcss/vite` at its peer ranges, can't be installed into a temporary Astro site that imports every component, stylesheet, and module, or `astro build` fails                                                                                                                                                                                                                                                              |
| Packaging lint     | `publint --strict` reports a problem, or `attw --profile esm-only` finds a type resolution problem                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Release docs       | `CHANGELOG.md` has no section for the version, the README lacks its title, summary, or sections in order, `API.md` is missing or differs from a fresh render of the package's TSDoc, or, in a package without Astro components, `RECIPES.md` is missing, lacks its title `# <name> recipes`, has no `## ` recipe, or has a recipe without a ` ```ts ` block                                                                                                                                                             |
| TSDoc              | an export lacks a summary, or a function or class lacks an `@example`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Versions on npm    | only for packages already on npm: see below                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

For a package already on npm:

- **Its version is already published.** The packed files must match the published tarball's, compared file by file. `devDependencies` and `scripts` are ignored, because consumers never use them. A sibling range that differs only because the sibling released a version the published range still covers, such as `^1.0.0` covering `1.1.0`, doesn't count either. Any other difference fails with "contents changed without a version bump".
- **Its version is new.** It must be higher than npm's `latest`, or `next` for a prerelease, and every sibling range must have a matching version on npm or in the same release.

The release commands run on Linux and macOS.

## What CI does on `main`

Every push to `main`, which is every merged pull request, runs these after the usual checks:

| Job       | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`   | After `pnpm check`, runs `pnpm release:pack` and uploads `.release/` as the `release` artifact, kept for a day.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `publish` | Checks each tarball against the manifest's SHA-256, then publishes, in manifest order, every version npm doesn't have, through the package's trusted publisher, and waits up to 15 minutes until npm serves them all, because npm takes a few minutes to release a new version. It skips versions already on npm, skips packages that aren't on npm yet with a warning, and stops before publishing a package whose sibling range has no version on npm or in the same run. It uploads the release's versions that are on npm as the `published` artifact. |
| `tag`     | Creates and pushes an annotated `<name>-v<version>` tag on the merged commit for each version in `published` that has no tag yet, as `github-actions[bot]`.                                                                                                                                                                                                                                                                                                                                                                                                |

`publish` installs no dependencies and holds `id-token: write` only so npm can verify the workflow. `tag` holds `contents: write` only to push its tags.

The same push deploys the website: `check` also uploads the built site, and the `deploy` job publishes it to GitHub Pages, without waiting for `publish`. [`deployment.md`](deployment.md) covers it.

## The first publish of a new package

CI only publishes packages that already exist on npm, because a package's trusted publisher can only be set up once it exists. The first version goes out by hand:

1. Merge the package to `main`, then pack the release from the merged `main`:

   ```bash
   git switch main && git pull
   pnpm install --frozen-lockfile
   pnpm build
   pnpm release:pack
   ```

   Expected result: `.release/` holds the package's tarball and `release-manifest.json`.

2. Sign in through a temporary npm config, so the login you use for other work stays as it is, publish the new packages' tarballs in the order `release-manifest.json` lists, then sign out and remove the config:

   ```bash
   mkdir -p /tmp/jg-npm-release && chmod 700 /tmp/jg-npm-release
   export NPM_CONFIG_USERCONFIG=/tmp/jg-npm-release/.npmrc
   npm login --auth-type=web
   npm whoami
   npm publish .release/<file> --access public
   npm logout
   unset NPM_CONFIG_USERCONFIG
   rm -rf /tmp/jg-npm-release
   ```

   `npm whoami` should print the account that owns the packages. Each publish asks you to approve it in the browser, which offers to skip the prompt for the next 5 minutes. `npm logout` also revokes the temporary session's token.

   npm can refuse a new name at this point as "too similar to existing package". Rename the package, following [Choose the name](creating-a-package.md#1-choose-the-name), merge the rename, and pack again.

3. Approve the release on npmjs.com. A new package's first publish is staged: until you approve it, npm shows only a `0.0.0-stage` version, which `latest` points to. Expected result: `npm view <name> dist-tags` shows the new version as `latest`.

4. On the package's settings page, `https://www.npmjs.com/package/<name>/access`:
   - add a trusted publisher: GitHub Actions, user `jesusgraterol`, repository `jg-packages`, workflow `ci.yml`, no environment, and tick **npm publish** under Allowed actions, which new entries leave off
   - set publishing access to "Require two-factor authentication and disallow tokens"

5. Once every version in `release-manifest.json` is on npm, tag them on the merged `main` and push the tags:

   ```bash
   node internal/release-checks/src/cli.ts tag --from .release --published .release/release-manifest.json
   ```

   Expected result: a `Pushed <name>-v<version>` line for each new version. It tags as `github-actions[bot]`, the same as CI, and skips the tags `origin` already has.

6. Remove `.release/`.

From then on, CI publishes every new version of the package, with provenance. The first version, published from your machine, has none.

## Deprecating a version

Never unpublish. Deprecate a broken version and release a fix:

```bash
npm deprecate jg-<name>@<version> "<what's wrong>, upgrade to <fixed version>"
```

A range in quotes deprecates every version in it. After the `1.1.0` fresh start, each package's older versions were deprecated this way, `<0.2.0` for `jg-fetch`, all signed in through one temporary npm config, as in [the first publish](#the-first-publish-of-a-new-package):

```bash
npm deprecate jg-fs@"<1.1.0" "Superseded by 1.1.0. Earlier versions don't work with the current jg-* packages."
```

Expected result: `npm view jg-fs@1.0.1 deprecated` prints the message, and `npm view jg-fs@1.1.0 deprecated` prints nothing.

## Troubleshooting

- **The publish job failed halfway.** Re-run the failed jobs. Versions already on npm are skipped, so it publishes only what's missing, and the tag job also tags what the failed run published.
- **The publish job fails with "npm accepted … but didn't serve them within 15 minutes".** npm accepted the versions but is still releasing them. Once `npm view <name>@<version> version` prints each one, re-run the failed jobs to tag them.
- **`release:pack` fails with "npm pack <name>@<version> failed" and a 404, right after a release.** npm lists a new version a few minutes before it serves its tarball. Wait until `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/<name>/-/<name>-<version>.tgz` prints `200`, remove `.release/`, which the failed run left its tarballs in, and pack again.
- **`npm publish` fails in CI with a bare `404 Not Found - PUT`.** The package has no trusted publisher, or it names another repository or workflow. Check its settings against step 4 of the first publish.
- **`npm publish` fails in CI with `403 OIDC permission denied`.** The trusted publisher exists, but **npm publish** isn't ticked under its Allowed actions.
- **`npm publish` fails with "Package name too similar to existing package".** npm refuses names a prefix away from a popular package. Pick another name, following [Choose the name](creating-a-package.md#1-choose-the-name).
- **"the example of … doesn't typecheck"**, from `release:verify`. The example uses something it neither imports nor defines, or uses the API wrongly. Add the import, define the input, or declare the reader's own input in the package's `examples.d.ts`. The message names the symbol and the example's line.
- **"the recipe … doesn't typecheck"**, from `release:verify`. A block of `RECIPES.md` uses something it neither imports nor declares, or uses the API wrongly, often because the API changed. Fix the block in the same change as the API. The message names the recipe, the block's position in it, and the line.
- **"the example of … fails"**. A runnable example threw, or a `// =>` result didn't hold: the message quotes the assertion. Fix the example, or the code if the example states the documented behavior. A result that varies, such as a random value, takes a plain comment instead of `// =>`.
- **"ERRORS.X ('X') is never asserted in a test"**, from `release:verify`. Add a test that produces the error and asserts its code in one of the forms above, such as `expectToThrowCode(() => decodeCursor('%'), ERRORS.INVALID_CURSOR)`. A code that only appears in a `test.each` table or a constant needs the code written into the assertion itself.
- **"API.md differs from a fresh render of the TSDoc"**, from `release:verify`. The TSDoc changed after the last build, or the renderer in `internal/api-reference` changed. Build the package again: `pnpm turbo run build --filter=<package>`. A changed `API.md` changes what ships, so the package needs a version bump, like any other change to its files.
- **A version already exists.** npm never accepts the same version twice. Bump the version and add its changelog section.
- **"contents changed without a version bump".** A file that ships changed while the version stayed the same. Bump the version and add the changelog section. A sibling's release within the published range never triggers it, but a sibling's new major does, so release the dependent with the new range. Dev-dependency updates and script edits never trigger it either. A toolchain update that changes the built output does, so release patch versions of the packages it names.
- **"depends on … which has no matching version on npm or in this release"**, from `release:verify`, or **"depends on … which has no version on npm"**, from the publish job. The package needs a sibling version that isn't published. Release the sibling first, or in the same pull request. When the sibling is new, publish it by hand first, as described above.
