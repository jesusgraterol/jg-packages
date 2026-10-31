import { useState } from 'react';
import { Link } from 'react-router';

import { CodeDiff as GenericCodeDiff } from 'jg-react-ui/components/code-diff';
import { Button, CodeDiff, Heading } from 'jg-personal-react-ui';

const PREFIX = Array.from({ length: 8 }, (_, index) => `// context line ${index}`).join('\n');
const SUFFIX = Array.from({ length: 8 }, (_, index) => `// final line ${index}`).join('\n');
const LONG_PATH = `/workspace/${'long-unbroken-agent-path'.repeat(32)}/session.ts`;

/** Compares actual personal and independently themed base consumers through public entries. */
export const DiffDemo = () => {
  const [revision, setRevision] = useState(2);
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
      <Heading level={1}>Review source changes</Heading>
      <section
        aria-label="JG source changes"
        className="mt-8 min-w-0"
      >
        <Heading level={2}>Session settings</Heading>
        <CodeDiff
          filePath="src/agent/session.ts"
          fileStatus="modified"
          headerMeta={`Revision ${revision}`}
          oldValue={`${PREFIX}\nconst retries = 4;\n${SUFFIX}`}
          newValue={`${PREFIX}\nconst retries = ${revision};\n${SUFFIX}`}
          language="typescript"
          extraLinesSurroundingDiff={0}
        />
        <Button
          className="mt-4"
          size="touch"
          onClick={() => setRevision((current) => current + 1)}
        >
          Update revision
        </Button>
      </section>
      <section
        aria-label="Long source lines"
        className="mt-8 min-w-0"
      >
        <Heading level={2}>Long paths stay inside the message</Heading>
        <CodeDiff
          oldValue={`const path = "${LONG_PATH}";`}
          newValue={`const path = "${LONG_PATH}.next";`}
          language="typescript"
          hideSummary
          codeDiffView="unified"
        />
      </section>
      <section
        aria-label="Consumer-owned theme"
        className="generic-ui-theme mt-8 min-w-0 rounded-lg border p-4"
      >
        <Heading level={2}>Independent consumer theme</Heading>
        <p className="mb-4">The base uses this application's colors and system fonts.</p>
        <GenericCodeDiff
          oldValue="const provider = 'first';"
          newValue="const provider = 'second';"
          language="typescript"
          hideSummary
          codeDiffView="unified"
        />
      </section>
    </main>
  );
};
