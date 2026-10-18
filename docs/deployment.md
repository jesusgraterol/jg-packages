# Deployment

How the site reaches [jg-packages.jesusgraterol.dev](https://jg-packages.jesusgraterol.dev): GitHub Pages serves the build, and Cloudflare sits in front of it, answering agents that ask for Markdown with each page's Markdown version. Packages are released separately, as [`releasing.md`](releasing.md) describes.

## How a deploy happens

Every push to `main` runs `.github/workflows/ci.yml`:

1. **`check`** runs `pnpm check`, which builds the site, runs `verify-build`, and runs the end-to-end suite against that build. It then uploads `website/dist` as the Pages artifact.
2. **`deploy`** needs `check`, and publishes the artifact with `actions/deploy-pages`, in the `github-pages` environment. It has only `pages: write` and `id-token: write`, gives up after 10 minutes, and runs in the `pages-production` concurrency group without cancelling, so a newer deploy waits for the one in progress.

Pull requests run `check` without uploading anything, so only what reaches `main` is deployed. `deploy` doesn't wait for `publish`, so the site can name a version a minute before npm serves it.

## GitHub Pages and the domain

The repository's Pages settings, which `gh api repos/jesusgraterol/jg-packages/pages` shows:

| Setting       | Value                           | Why                                                                                      |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Source        | GitHub Actions (`workflow`)     | `deploy` publishes the artifact; no branch is served                                     |
| Custom domain | `jg-packages.jesusgraterol.dev` | Set in the settings, so the build has no `CNAME` file                                    |
| Enforce HTTPS | Off                             | Cloudflare proxies the domain, so GitHub has no certificate for it; Cloudflare redirects |

To set them from scratch:

```bash
gh api --method POST repos/jesusgraterol/jg-packages/pages -f build_type=workflow
gh api --method PUT repos/jesusgraterol/jg-packages/pages -f build_type=workflow -f cname=jg-packages.jesusgraterol.dev
```

**The DNS record,** in Cloudflare's `jesusgraterol.dev` zone: a proxied `CNAME` from `jg-packages` to `jesusgraterol.github.io`. jesusgraterol.dev is served the same way, through the zone's SSL/TLS mode and its `http://` to `https://` redirect. If either is set for that hostname alone rather than for the zone, extend it to `jg-packages`; the checks below show a redirect loop or a certificate error otherwise.

## Markdown for agents

Each page's Markdown version is a static file, `index.md`, beside its `index.html`. Two Cloudflare Transform Rules let an agent get it from the page's own URL by sending `Accept: text/markdown`, while browsers keep getting HTML. Create each in the `jesusgraterol.dev` zone from **Rules** > **Overview**, with the **Create rule** button of its rule type's box. Choose **Custom filter expression**, select **Edit expression**, and paste the expression into the box:

1. **The rewrite.** Create a **URL Rewrite Rule**:
   - Name: `jg-packages Markdown`.
   - Expression:

     ```text
     http.host eq "jg-packages.jesusgraterol.dev" and any(http.request.headers["accept"][*] contains "text/markdown") and ends_with(http.request.uri.path, "/")
     ```

   - Path: **Rewrite to**, **Dynamic**, `concat(http.request.uri.path, "index.md")`. Query: **Preserve**.

2. **The `Vary` header.** Create a **Response Header Transform Rule**, so caches keep the two answers apart:
   - Name: `jg-packages Vary`.
   - Expression:

     ```text
     http.host eq "jg-packages.jesusgraterol.dev" and ends_with(raw.http.request.uri.path, "/")
     ```

   - Under **Modify response header**: **Add static**, with **Header name** `Vary` and **Value** `Accept`. **Add static**, not **Set static**: GitHub Pages already sends `Vary: Accept-Encoding`, which must stay.

The rewrite only changes the path Cloudflare asks GitHub Pages for, so the visitor's URL stays the page's. Cloudflare doesn't cache HTML by default; a cache rule that later caches pages must add `Accept` to its cache key.

**The content-type fallback.** Add it only when the checks below show GitHub Pages serving `index.md` with a type other than `text/markdown`. Create a third **Response Header Transform Rule**:

- Name: `jg-packages Markdown type`.
- Expression: `http.host eq "jg-packages.jesusgraterol.dev" and ends_with(http.request.uri.path, ".md")`. It reads the rewritten path, so it covers the rewritten responses and every `index.md`.
- Under **Modify response header**: **Set static**, with **Header name** `Content-Type` and **Value** `text/markdown; charset=utf-8`.

## Checks

Before the first deploy, both destinations of the home page's agent setup must be live, because the site links to them:

| Check                                                                                                      | Expected                                    |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `curl -sL https://jg-skills.jesusgraterol.dev/skills/jg-packages/`                                         | `200`, the skill's page, naming jg-packages |
| `curl -sL https://github.com/jesusgraterol/jg-skills/raw/main/skills/jg-packages/assets/agents-section.md` | `200`, starting with `## jg-packages`       |

After a deploy, and after any change to the rules:

| Check                                                                                              | Expected                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `curl -sI https://jg-packages.jesusgraterol.dev/packages/jg-utilities/`                            | `text/html`, with `Vary` covering `Accept-Encoding` and `Accept`                         |
| `curl -sI -H 'Accept: text/markdown' https://jg-packages.jesusgraterol.dev/packages/jg-utilities/` | `text/markdown`, with the same `Vary`                                                    |
| `curl -s https://jg-packages.jesusgraterol.dev/packages/jg-utilities/index.md`                     | The same body as the line above                                                          |
| `curl -s https://jg-packages.jesusgraterol.dev/packages/jg-utilities/recipes/index.md`             | The package's `RECIPES.md`                                                               |
| `curl -s https://jg-packages.jesusgraterol.dev/llms.txt`                                           | The ten packages, their recipes pages, and the setup links; nothing about the UI package |
| `curl -sI https://jg-packages.jesusgraterol.dev/packages/jg-utilities/index.md`                    | `text/markdown`; otherwise add the content-type fallback and check again                 |

## Rolling back

- **A bad deploy:** revert the commit on `main` through a pull request. Its run deploys the reverted site. Re-running an older run's `deploy` job doesn't work after a day, because the Pages artifact expires.
- **Markdown negotiation misbehaving:** turn off the rewrite rule in Cloudflare. Pages and their `index.md` files keep working; agents read `index.md` directly, as `llms.txt` links it.
- **Taking the site down:** `gh api --method DELETE repos/jesusgraterol/jg-packages/pages` unpublishes it. Set it up again as [above](#github-pages-and-the-domain).
