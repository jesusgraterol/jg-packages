// what the TSDoc examples use but don't define; release check 8 typechecks them with it, and it
// never ships

// a secret the app reads from its configuration
declare const secret: string;

// a webhook request's body, exactly as it arrived, before any parsing
declare const rawBody: Buffer;

// the request's signature header, such as GitHub's X-Hub-Signature-256
declare const signatureHeader: string;

// the secret the webhook provider signs with
declare const webhookSecret: string;
