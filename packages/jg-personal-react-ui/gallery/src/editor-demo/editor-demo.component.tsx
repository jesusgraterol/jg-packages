import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createErrorFeedback, Exception } from 'jg-exception';

import {
  AudioInput,
  Button,
  ChatMarkdownEditor,
  ErrorFeedbackProvider,
  FileUploadDialog,
  Heading,
  Markdown,
  MarkdownEditor,
  MARKDOWN_EDITOR_AUTHORING_TOOLS,
  PageHeader,
  PageShell,
  PageTitle,
  type IAudioInputTranscribeHandler,
  type IAudioInputTranscriptionResultHandler,
  type IChatMarkdownEditorControls,
  type IFileUploadDialogSubmitHandler,
  type IFileUploadProps,
  type IMarkdownEditorLayout,
} from 'jg-personal-react-ui';

import jgMarkUrl from 'jg-personal-ui/jg-mark.svg?no-inline';

import { waitForInputProvider } from '../input-demo/utilities.js';

const RICH_DOCUMENT = [
  '## Release checklist',
  'Review {{PROJECT_NAME}} before publishing. The path is `/workspace/' +
    'long-unbroken-path'.repeat(16) +
    '`.',
  '| Step | Command |\n| --- | --- |\n| Verify | `pnpm --filter jg-personal-react-ui test:e2e` |',
  '```ts\nconst releasePath = "' +
    '/workspace/' +
    'long-command'.repeat(32) +
    '";\n// Review the package before publishing.\nfunction releaseCount(count: number) { return count + 1; }\n```',
  'Inline math: $E=mc^2$.',
  `![2.00](${jgMarkUrl} "Project mark")`,
  '[Release walkthrough](https://www.youtube.com/watch?v=M7lc1UVf-VE)',
].join('\n\n');

const FILE_TYPES = ['text/plain'];
const editorErrorPolicy = createErrorFeedback({
  fallbackMessage: 'The input service is unavailable. Try again.',
  messagesByCode: {
    GALLERY_DRAFT_FULL: 'Shorten the message before inserting more text.',
    GALLERY_INPUT_UNAVAILABLE: 'The input service is unavailable. Try again.',
  },
});

/** Exercises the public document and chat APIs with caller-owned attachment and voice adapters. */
export const EditorDemo = () => {
  const [layout, setLayout] = useState<IMarkdownEditorLayout>('auto');
  const [notes, setNotes] = useState('## Weekly notes\n\nReview {{PROJECT_NAME}} before release.');
  const [message, setMessage] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('No message submitted.');
  const [hasAllTools, setHasAllTools] = useState(true);
  const controlsRef = useRef<IChatMarkdownEditorControls>(null);
  const requestsRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestsRef.current = controller;
    return () => controller.abort();
  }, []);

  const uploadFile = useCallback<IFileUploadProps<string>['uploadFile']>(
    async (file, { signal }) => {
      await waitForInputProvider(
        'upload',
        requestsRef.current === null ? [signal] : [signal, requestsRef.current.signal],
      );
      return file.name;
    },
    [],
  );

  /**
   * Inserts caller-owned plain text without turning dictated Markdown into formatting.
   * @throws
   * - GALLERY_DRAFT_FULL: Shorten the message before inserting more text.
   */
  const insertText = useCallback((text: string): void => {
    if (!controlsRef.current?.appendLiteralText(text)) {
      throw new Exception('Shorten the message before inserting more text.', {
        code: 'GALLERY_DRAFT_FULL',
      });
    }
    controlsRef.current.focus();
  }, []);

  const attachFiles = useCallback<IFileUploadDialogSubmitHandler<string>>(
    (items) => {
      insertText(items.map((item) => `Attachment: ${item.result}`).join('\n'));
    },
    [insertText],
  );

  const transcribe = useCallback<IAudioInputTranscribeHandler>(async () => {
    await waitForInputProvider(
      'transcribe',
      requestsRef.current === null ? [] : [requestsRef.current.signal],
    );
    return 'Review the deployment notes before sending.';
  }, []);

  const insertTranscription = useCallback<IAudioInputTranscriptionResultHandler>(
    async (text) => {
      await waitForInputProvider(
        'send',
        requestsRef.current === null ? [] : [requestsRef.current.signal],
      );
      insertText(text);
    },
    [insertText],
  );

  return (
    <ErrorFeedbackProvider resolveErrorFeedback={editorErrorPolicy}>
      <PageShell className="min-h-svh">
        <PageHeader>
          <PageTitle>Markdown editors</PageTitle>
        </PageHeader>
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
        <section
          aria-label="Document authoring"
          className="mt-8 grid min-w-0 grid-cols-1 gap-4"
        >
          <Heading level={2}>Project notes</Heading>
          <div
            aria-label="Editor layout"
            role="group"
            className="flex flex-wrap gap-2"
          >
            {(['auto', 'compact', 'wide'] as const).map((mode) => (
              <Button
                key={mode}
                aria-pressed={layout === mode}
                onClick={() => setLayout(mode)}
                size="touch"
                variant="outline"
              >
                {mode}
              </Button>
            ))}
            <Button
              onClick={() => setNotes(RICH_DOCUMENT)}
              size="touch"
              variant="outline"
            >
              Load rich document
            </Button>
            <Button
              aria-pressed={!hasAllTools}
              onClick={() => setHasAllTools((previous) => !previous)}
              size="touch"
              variant="outline"
            >
              Constrain tools
            </Button>
          </div>
          <MarkdownEditor
            aria-label="Project notes"
            layout={layout}
            onChange={setNotes}
            {...(hasAllTools ? {} : { supportedTools: MARKDOWN_EDITOR_AUTHORING_TOOLS })}
            value={notes}
          />
          <details>
            <summary className="cursor-pointer py-3">Serialized document</summary>
            <pre
              aria-label="Serialized document"
              className="max-w-full overflow-auto whitespace-pre-wrap wrap-anywhere"
            >
              {notes}
            </pre>
          </details>
          <Markdown>{notes}</Markdown>
        </section>
        <section
          aria-label="Chat authoring"
          className="mt-8 grid min-w-0 grid-cols-1 gap-3"
        >
          <Heading level={2}>Message draft</Heading>
          <ChatMarkdownEditor
            controlsRef={controlsRef}
            maxLength={2048}
            onChange={setMessage}
            onSubmitRequest={setSubmittedMessage}
            value={message}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FileUploadDialog
              fileUploadProps={{
                acceptedFileTypes: FILE_TYPES,
                maxFileBytes: 4096,
                maxFiles: 2,
                uploadFile,
              }}
              onSubmit={attachFiles}
              title="Attach notes"
              trigger={
                <Button
                  size="touch"
                  variant="outline"
                >
                  Attach notes
                </Button>
              }
            />
            <AudioInput
              onTranscriptionResult={insertTranscription}
              transcribe={transcribe}
            />
            <Button
              onClick={() => setSubmittedMessage(controlsRef.current?.getMarkdown() ?? message)}
              size="touch"
            >
              Submit message
            </Button>
          </div>
          <output
            aria-label="Submitted message"
            className="block min-w-0 whitespace-pre-wrap wrap-anywhere"
          >
            {submittedMessage}
          </output>
        </section>
      </PageShell>
    </ErrorFeedbackProvider>
  );
};
