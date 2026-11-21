# jg-publishing-guides

Render a reviewed file selection into an offline publishing guide and its plain-text fallback. Runs on Node.js 22.17 or later.

## Install

```sh
npm install jg-publishing-guides
```

## Usage

`renderPublishingGuide` takes a title, a summary, selected files, optional channel steps and literal copy keyed by selected path. It returns `html` for `start-here.html` and `readme` for `readme.txt`. Keep both files alongside the selected outputs. The English or Spanish interface follows the requested locale. Reviewed copy remains in its original language.

Use a file-only guide for a handoff without channel steps. Channel guides support ordered image uploads, document posts, TikTok captions with an optional separate title, and Instagram reposts of a preceding, explicitly identified original. The HTML offers keyboard navigation, file links and copy controls with manual selection on clipboard refusal. Its inline script is authorized by its exact CSP hash. The page uses system light and dark modes and needs no server or installation.

The renderer validates portable paths and presentation references. Your caller owns file access, selection and publication approval. The guide provides instructions for manual publication.

## Errors

| Code                       | Message                                |
| -------------------------- | -------------------------------------- |
| `INVALID_PUBLISHING_GUIDE` | The publishing guide input is invalid. |

## Documentation

See [API.md](API.md) for the contracts and [RECIPES.md](RECIPES.md) for an example.

## License

[MIT](LICENSE)
