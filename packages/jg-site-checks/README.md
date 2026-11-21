# jg-site-checks

Verify a built static website against an explicit page inventory. The checker reads local files with bounded memory and never contacts the network. Runs on Node.js 22.17 or later.

## Install

```sh
npm install --save-dev jg-site-checks
```

## Usage

Pass `verifyStaticSite` the artifact directory, production origin and expected public page paths. Each page declares its exact canonical URL or `null`, and whether it should be indexed. The checker verifies those expectations, same-origin HTML links and fragments, and the supplied discovery files.

A sitemap can be a URL set or an index of local URL sets. Its URLs must match the indexable canonical inventory exactly. Parsed entries include the sitemap's `lastmod` text when present so a caller can check its own dates. Optional robots verification requires the configured sitemap reference. Optional `llms.txt` verification checks local Markdown link targets. Site-specific crawl policy, page content and search index checks belong in the caller.

A path with a trailing slash resolves to its `index.html`. Other paths resolve to an existing file, then a directory index or a matching `.html` file. HTML links with a different origin are ignored. Links, robots references and sitemap locations are never fetched. Build the artifact before verifying it and keep it unchanged until the check finishes. The default limits are 16,384 file and directory entries, 8 MiB per text file and 128 MiB of text per build.

## Errors

| Code                         | Message                                          |
| ---------------------------- | ------------------------------------------------ |
| `INVALID_SITE_BUILD_OPTIONS` | The site build verification options are invalid. |
| `SITE_BUILD_INVALID`         | The static site build failed verification.       |

## Documentation

See [API.md](API.md) for the contracts and [RECIPES.md](RECIPES.md) for an example.

## License

[MIT](LICENSE)
