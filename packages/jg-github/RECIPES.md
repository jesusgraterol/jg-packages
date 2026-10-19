# jg-github recipes

Patterns for services that act as a GitHub App: short-lived tokens scoped to one job, and webhook routes that trust only what GitHub signed.

## A scoped installation token, revoked when done

Use this when a job reads or writes a repository on an installation's behalf, such as a release bot that reads a repository's changelog. The token can reach that one repository with read access to its contents, nothing else the installation allows, and it's revoked as soon as the job ends instead of staying valid for an hour:

```ts
import { request } from 'jg-fetch';
import {
  buildGithubApiUrl,
  createGithubHeaders,
  createInstallationToken,
  revokeInstallationToken,
} from 'jg-github';

// the App's credentials and the installation, from the app's configuration
declare const appId: number;
declare const privateKey: string;
declare const installationId: number;

const USER_AGENT = 'acme-release-bot';

// reads a repository's CHANGELOG.md, as text, from the default branch
export const readChangelog = async (owner: string, repository: string): Promise<string> => {
  const { token } = await createInstallationToken({
    appId,
    privateKey,
    installationId,
    repositories: [repository],
    permissions: { contents: 'read' },
    userAgent: USER_AGENT,
  });
  try {
    const { data, error } = await request(
      buildGithubApiUrl(['repos', owner, repository, 'contents', 'CHANGELOG.md']),
      {
        headers: {
          ...createGithubHeaders(token, { userAgent: USER_AGENT }),
          accept: 'application/vnd.github.raw+json',
        },
        parseAs: 'text',
        maxResponseBytes: 1_048_576,
        init: { redirect: 'error' },
      },
    );
    if (error !== null) {
      throw error;
    }
    return data;
  } finally {
    try {
      await revokeInstallationToken(token, { userAgent: USER_AGENT });
    } catch {
      // the token still expires within the hour; the error never holds it
      console.error("The release bot's installation token couldn't be revoked.");
    }
  }
};
```

`permissions` must name what the job needs: GitHub reads a request without it as every permission the installation has, so `createInstallationToken` refuses one before sending it. The token GitHub grants is checked against the request, and one that reaches another repository or has another permission is revoked and refused with `GITHUB_TOKEN_SCOPE_MISMATCH`. Revoking in a `finally` covers a job that throws, and catching the revocation's own failure keeps it from replacing the job's error.

## A webhook route

Use this in the route that receives a GitHub App's webhook deliveries. GitHub signs each body with the webhook's secret and sends the signature in `X-Hub-Signature-256`; verify it over the exact bytes received, before parsing them, because parsing and serializing can change the bytes:

```ts
import { verifyGithubWebhookSignature } from 'jg-github';

// the request as your framework exposes it, with the body kept as raw bytes
type IWebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
};

// the webhook's secret, from the app's configuration
declare const webhookSecret: string;

// the outcome of a delivery: a status for the response, and the event when it's authentic
export const receiveGithubWebhook = (
  request: IWebhookRequest,
): { status: number; event: { name: string; deliveryId: string; payload: unknown } | null } => {
  const { headers, rawBody } = request;
  if (!verifyGithubWebhookSignature(rawBody, headers['x-hub-signature-256'], webhookSecret)) {
    return { status: 401, event: null };
  }
  const name = headers['x-github-event'];
  const deliveryId = headers['x-github-delivery'];
  if (typeof name !== 'string' || typeof deliveryId !== 'string') {
    return { status: 400, event: null };
  }
  return {
    status: 202,
    event: { name, deliveryId, payload: JSON.parse(rawBody.toString('utf8')) },
  };
};
```

`verifyGithubWebhookSignature` treats a missing, repeated, overlong, or malformed header as a wrong signature, so the route needs no checks of its own, and compares in constant time, so the responses' timing reveals nothing about the signature. GitHub redelivers a delivery that failed, with the same `X-GitHub-Delivery`, so a handler with side effects records the delivery IDs it has processed and skips a repeat.
