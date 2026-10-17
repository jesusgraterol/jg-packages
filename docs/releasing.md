# Releasing

How versions are chosen, checked, published, and tagged. Releases are cut from `main`: CI packs every package, publishes the versions npm doesn't have yet, and tags them. You never run `npm publish` by hand except for a package's first version.

> The CI jobs that publish and tag arrive with the first release of the packages, so until then nothing is published.

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

| Check              | Fails when                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File list          | the tarball ships something outside `files` (besides `package.json`, `README.md`, `LICENSE`, and `CHANGELOG.md`), a test or `.tsbuildinfo` file, or is missing an `exports` or `bin` target                   |
| Install and import | the tarballs can't be installed together into a temporary project, an installed manifest still has a `workspace:` or `catalog:` range, a subpath can't be imported by name, or a private path can be imported |
| Packaging lint     | `publint --strict` reports a problem, or `attw --profile esm-only` finds a type resolution problem                                                                                                            |
| Release docs       | `CHANGELOG.md` has no section for the version, or the README lacks its title, summary, or sections in order                                                                                                   |
| TSDoc              | an export lacks a summary, or a function or class lacks an `@example`                                                                                                                                         |
| Versions on npm    | only for packages already on npm: see below                                                                                                                                                                   |

For a package already on npm:

- **Its version is already published.** The packed files must match the published tarball's, compared file by file. `devDependencies` and `scripts` are ignored, because consumers never use them. A sibling range that differs only because the sibling released a version the published range still covers, such as `^1.0.0` covering `1.1.0`, doesn't count either. Any other difference fails with "contents changed without a version bump".
- **Its version is new.** It must be higher than npm's `latest`, or `next` for a prerelease, and every sibling range must have a matching version on npm or in the same release.

The release commands run on Linux and macOS.

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

2. Sign in to npm and publish the tarball with two-factor authentication:

   ```bash
   npm login
   npm publish .release/<file> --access public
   ```

   Publish in the order `release-manifest.json` lists, when there are several.

3. On the package's settings page on npmjs.com:
   - add a trusted publisher: GitHub Actions, repository `jesusgraterol/jg-packages`, workflow `ci.yml`
   - set publishing access to "Require two-factor authentication and disallow tokens"

4. Tag the release and push the tag:

   ```bash
   git tag --annotate jg-<name>-v<version> --message "jg-<name> <version>"
   git push origin refs/tags/jg-<name>-v<version>
   ```

5. Remove `.release/`.

From then on, CI publishes every new version of the package.

## Deprecating a version

Never unpublish. Deprecate a broken version and release a fix:

```bash
npm deprecate jg-<name>@<version> "<what's wrong>, upgrade to <fixed version>"
```

## Troubleshooting

- **The publish job failed halfway.** Re-run it. Versions already on npm are skipped, so it publishes only what's missing.
- **`npm publish` fails with an OIDC or 404 error in CI.** The package's trusted publisher is missing or names another workflow. Check its settings on npmjs.com against step 3 of the first publish.
- **A version already exists.** npm never accepts the same version twice. Bump the version and add its changelog section.
- **"contents changed without a version bump".** A file that ships changed while the version stayed the same. Bump the version and add the changelog section. A sibling's release within the published range never triggers it, but a sibling's new major does, so release the dependent with the new range. Dev-dependency updates and script edits never trigger it either. A toolchain update that changes the built output does, so release patch versions of the packages it names.
- **"depends on … which has no matching version on npm or in this release".** The package needs a sibling version that isn't published. Release the sibling first, or in the same pull request.
