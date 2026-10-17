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
- A package needs a release only when the files it ships changed. `release:verify` decides that from the packed tarball, not from the diff, so a change to tests, `devDependencies`, or scripts needs no release.

## Releasing a version

1. Bump `version` in the package's `package.json`, and add a `## <version>` section at the top of its `CHANGELOG.md`, with `### Added`, `### Changed`, `### Deprecated`, `### Removed`, or `### Fixed` subsections as needed.
2. Update the README when the change affects what it documents. The README is the package's npm page for that version.
3. Run every check:

   ```bash
   pnpm check
   ```

   Expected result: `release:verify` prints `PASS <name>@<version>` for every package.

4. Commit on `development`, open a pull request to `main`, and merge it once CI passes. CI publishes the new version and pushes its `<name>-v<version>` tag.

### Releasing with a sibling it needs

`workspace:^` packs as `^<the sibling's current version>`. When a package starts using something a sibling added in a new version, release both in the same pull request. CI publishes in dependency order, so the sibling reaches npm first, and the dependent never ships ahead of it.

### Prereleases

A version with a prerelease part, such as `1.2.0-beta.0`, is published under the `next` dist-tag, so `npm install <name>` keeps getting the latest stable version. A fix for an older major version is released by hand from a branch, with its own dist-tag, such as `npm publish <file> --tag v1`.

## What `release:verify` checks

`pnpm release:verify` packs every package under `packages/` that isn't private, checks the tarballs, and removes them. `pnpm release:pack` runs the same checks and keeps the tarballs in `.release/`, with a `release-manifest.json` that lists each one in publish order with its SHA-256.

| Check              | Fails when                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File list          | the tarball ships something outside `files` (besides `package.json`, `README.md`, `LICENSE`, and `CHANGELOG.md`), a test or `.tsbuildinfo` file, or is missing an `exports` or `bin` target                                                                |
| Install and import | the tarballs can't be installed together into a temporary project, an installed manifest still has a `workspace:` or `catalog:` range, a subpath can't be imported by name, a private path can be imported, or an installed command fails `--help`         |
| Astro fixture      | only for packages with Astro components: the tarball, with `astro`, `tailwindcss`, and `@tailwindcss/vite` at its peer ranges, can't be installed into a temporary Astro site that imports every component, stylesheet, and module, or `astro build` fails |
| Packaging lint     | `publint --strict` reports a problem, or `attw --profile esm-only` finds a type resolution problem                                                                                                                                                         |
| Release docs       | `CHANGELOG.md` has no section for the version, or the README lacks its title, summary, or sections in order                                                                                                                                                |
| TSDoc              | an export lacks a summary, or a function or class lacks an `@example`                                                                                                                                                                                      |
| Versions on npm    | only for packages already on npm: see below                                                                                                                                                                                                                |

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

## Troubleshooting

- **The publish job failed halfway.** Re-run the failed jobs. Versions already on npm are skipped, so it publishes only what's missing, and the tag job also tags what the failed run published.
- **The publish job fails with "npm accepted … but didn't serve them within 15 minutes".** npm accepted the versions but is still releasing them. Once `npm view <name>@<version> version` prints each one, re-run the failed jobs to tag them.
- **`npm publish` fails in CI with a bare `404 Not Found - PUT`.** The package has no trusted publisher, or it names another repository or workflow. Check its settings against step 4 of the first publish.
- **`npm publish` fails in CI with `403 OIDC permission denied`.** The trusted publisher exists, but **npm publish** isn't ticked under its Allowed actions.
- **`npm publish` fails with "Package name too similar to existing package".** npm refuses names a prefix away from a popular package. Pick another name, following [Choose the name](creating-a-package.md#1-choose-the-name).
- **A version already exists.** npm never accepts the same version twice. Bump the version and add its changelog section.
- **"contents changed without a version bump".** A file that ships changed while the version stayed the same. Bump the version and add the changelog section. A sibling's release within the published range never triggers it, but a sibling's new major does, so release the dependent with the new range. Dev-dependency updates and script edits never trigger it either. A toolchain update that changes the built output does, so release patch versions of the packages it names.
- **"depends on … which has no matching version on npm or in this release"**, from `release:verify`, or **"depends on … which has no version on npm"**, from the publish job. The package needs a sibling version that isn't published. Release the sibling first, or in the same pull request. When the sibling is new, publish it by hand first, as described above.
