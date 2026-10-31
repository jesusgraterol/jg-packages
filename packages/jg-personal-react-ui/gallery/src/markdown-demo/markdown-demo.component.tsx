import { useState } from 'react';
import { Link } from 'react-router';

import markUrl from 'jg-personal-ui/jg-mark.svg?no-inline';

import { Button, CodeBlock, Heading, Markdown } from 'jg-personal-react-ui';

const TOKEN = 'unbrokencommand'.repeat(24);
const MESSAGE = `## Review ${TOKEN}

The agent reviewed \`/workspace/${TOKEN}\` and returned the complete result.

- Run \`pnpm --filter=${TOKEN}\` before continuing.
- ${TOKEN}

### ${TOKEN}

The response remains readable in the message column.`;
const DETAILS = `

\`\`\`typescript
const command = "${TOKEN}";
\`\`\`

| Artifact | Command | Duration | Outcome |
| --- | --- | --- | --- |
| agent | \`${TOKEN}\` | 128ms | Complete |

Message end.`;

/** Exercises consumer-owned message columns and preview controls with real package renderers. */
export const MarkdownDemo = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <main className="mx-auto min-w-0 max-w-5xl p-4">
      <Button
        asChild
        size="touch"
        variant="link"
      >
        <Link
          role="link"
          to="/"
        >
          Back to gallery
        </Link>
      </Button>
      <Heading level={1}>Agent messages and source</Heading>
      {(['flex', 'grid'] as const).map((layout) => (
        <section
          key={layout}
          aria-label={`${layout} message layout`}
          className={
            layout === 'flex'
              ? 'mt-8 flex max-w-full gap-2 overflow-hidden'
              : 'mt-8 grid max-w-full grid-cols-[2rem_minmax(0,1fr)] gap-2 overflow-hidden'
          }
        >
          <span
            aria-hidden="true"
            className="w-8 shrink-0 pt-1 text-xs font-bold"
          >
            JG
          </span>
          <article
            aria-label={`${layout} agent message`}
            className="min-w-0 flex-1"
          >
            <Markdown>{MESSAGE + (isExpanded ? DETAILS : '')}</Markdown>
            <Button
              size="touch"
              variant="ghost"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((previous) => !previous)}
            >
              {isExpanded ? 'Collapse message' : 'Show more'}
            </Button>
          </article>
        </section>
      ))}
      <section
        aria-label="Source preferences"
        className="mt-8 min-w-0"
      >
        <Heading level={2}>Source preferences</Heading>
        <CodeBlock
          language="typescript"
          filePath="src/agent/session.ts"
          fileStatus="modified"
        >{`const deployment = "${TOKEN}";\n`}</CodeBlock>
        <CodeBlock
          language="diff-typescript"
          filePath="src/agent/config.ts"
        >
          {'@@ -1 +1 @@\n-const retries = 4;\n+const retries = 2;\n'}
        </CodeBlock>
      </section>
      <section
        aria-label="Document rendering"
        className="mt-8 min-w-0"
      >
        <Heading level={2}>Document rendering</Heading>
        <Markdown>{`### Release notes

The current template uses {{PROJECT_NAME}}.

![JG mark](${markUrl} "width=64")

[Walkthrough](https://youtu.be/M7lc1UVf-VE)`}</Markdown>
      </section>
    </main>
  );
};
