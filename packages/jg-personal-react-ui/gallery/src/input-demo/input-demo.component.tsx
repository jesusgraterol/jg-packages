import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createErrorFeedback } from 'jg-exception';

import {
  AudioInput,
  Button,
  ErrorFeedbackProvider,
  FileUpload,
  FileUploadDialog,
  ImageUploadField,
  PageDescription,
  PageHeader,
  PageShell,
  PageTitle,
  type IAudioInputTranscribeHandler,
  type IAudioInputTranscriptionResultHandler,
  type IFileUploadDialogSubmitHandler,
  type IFileUploadProps,
  type IImageUploadFieldCurrentImage,
} from 'jg-personal-react-ui';

import { waitForInputProvider } from './utilities.js';

const FILE_TYPES = ['text/plain', 'image/png', 'image/jpeg'];
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const inputErrorPolicy = createErrorFeedback({
  fallbackMessage: 'The input service is unavailable. Try again.',
  messagesByCode: {
    GALLERY_INPUT_UNAVAILABLE: 'The input service is unavailable. Try again.',
  },
});

/** Exercises the published upload, image, and recording flows with caller-owned adapters. */
export const InputDemo = () => {
  const requestsRef = useRef<AbortController | null>(null);
  const [latestUpload, setLatestUpload] = useState('No file uploaded yet');
  const [finalizedFiles, setFinalizedFiles] = useState('No files added yet');
  const [discardedCount, setDiscardedCount] = useState(0);
  const [image, setImage] = useState<IImageUploadFieldCurrentImage | null>(null);
  const [sentText, setSentText] = useState('No transcription sent yet');

  useEffect(() => {
    const controller = new AbortController();
    requestsRef.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (image === null) return;
    return () => URL.revokeObjectURL(image.imageUrl);
  }, [image]);

  const uploadFile = useCallback<IFileUploadProps<string>['uploadFile']>(
    async (file, { reportProgress, signal }) => {
      const signals = [signal];
      if (requestsRef.current !== null) signals.push(requestsRef.current.signal);
      reportProgress(Math.floor(file.size / 2), file.size);
      await waitForInputProvider('upload', signals);
      reportProgress(file.size, file.size);
      return file.name;
    },
    [],
  );

  const finalizeFiles = useCallback<IFileUploadDialogSubmitHandler<string>>(async (items) => {
    await waitForInputProvider(
      'finalize',
      requestsRef.current === null ? [] : [requestsRef.current.signal],
    );
    setFinalizedFiles(items.map((item) => item.result).join(', '));
  }, []);

  const useImage = useCallback<IFileUploadDialogSubmitHandler<string>>((items) => {
    const item = items[0];
    if (item === undefined) return;
    setImage({ fileName: item.file.name, imageUrl: URL.createObjectURL(item.file) });
  }, []);

  const transcribe = useCallback<IAudioInputTranscribeHandler>(async () => {
    await waitForInputProvider(
      'transcribe',
      requestsRef.current === null ? [] : [requestsRef.current.signal],
    );
    return 'Review the deployment notes before sending.';
  }, []);

  const sendTranscription = useCallback<IAudioInputTranscriptionResultHandler>(async (text) => {
    await waitForInputProvider(
      'send',
      requestsRef.current === null ? [] : [requestsRef.current.signal],
    );
    setSentText(text);
  }, []);

  return (
    <ErrorFeedbackProvider resolveErrorFeedback={inputErrorPolicy}>
      <PageShell className="min-h-svh">
        <PageHeader>
          <PageTitle>Files and dictation</PageTitle>
          <PageDescription>
            Choose files, review upload results, and edit a voice note.
          </PageDescription>
        </PageHeader>
        <Button
          size="touch"
          variant="outline"
          asChild
        >
          <Link
            role="link"
            to="/"
          >
            Back to gallery
          </Link>
        </Button>
        <div className="mt-8 grid min-w-0 gap-8">
          <section
            aria-labelledby="upload-title"
            className="grid min-w-0 gap-3"
          >
            <h2
              id="upload-title"
              className="text-xl font-semibold"
            >
              Attachments
            </h2>
            <FileUpload
              acceptedFileTypes={FILE_TYPES}
              label="Attach files"
              description="Text and image files, up to 4 KB each."
              maxFileBytes={4096}
              maxFiles={4}
              maxConcurrentUploads={2}
              uploadFile={uploadFile}
              onUploadSuccess={(item) => setLatestUpload(item.result)}
            />
            <p
              role="status"
              aria-label="Latest upload"
              className="text-sm wrap-anywhere"
            >
              {latestUpload}
            </p>
          </section>
          <section
            aria-labelledby="dialog-upload-title"
            className="grid min-w-0 gap-3"
          >
            <h2
              id="dialog-upload-title"
              className="text-xl font-semibold"
            >
              Add files together
            </h2>
            <FileUploadDialog
              title="Add attachments"
              fileUploadProps={{
                acceptedFileTypes: FILE_TYPES,
                maxFileBytes: 4096,
                maxFiles: 2,
                uploadFile,
              }}
              onSubmit={finalizeFiles}
              onDiscard={(items) => setDiscardedCount((count) => count + items.length)}
              trigger={
                <Button
                  size="touch"
                  className="justify-self-start"
                >
                  Add attachments
                </Button>
              }
            />
            <p
              role="status"
              aria-label="Finalized attachments"
              className="text-sm wrap-anywhere"
            >
              {finalizedFiles}
            </p>
            <p
              role="status"
              aria-label="Discarded uploads"
              className="text-secondary-foreground text-sm"
            >
              Discarded uploads: {discardedCount}
            </p>
          </section>
          <section
            aria-labelledby="image-title"
            className="grid min-w-0 gap-3"
          >
            <h2
              id="image-title"
              className="text-xl font-semibold"
            >
              Project image
            </h2>
            <ImageUploadField
              acceptedFileTypes={IMAGE_TYPES}
              currentImage={image}
              label="Project image"
              maxFileBytes={4096}
              uploadFile={uploadFile}
              onSubmit={useImage}
              onCurrentImageRemove={() => setImage(null)}
            />
          </section>
          <section
            aria-labelledby="audio-title"
            className="grid min-w-0 gap-3"
          >
            <h2
              id="audio-title"
              className="text-xl font-semibold"
            >
              Voice note
            </h2>
            <p className="text-secondary-foreground text-sm">
              Transcribe to review the text, or send the recording directly.
            </p>
            <AudioInput
              className="justify-self-start"
              transcribe={transcribe}
              onTranscriptionResult={sendTranscription}
            />
            <p
              role="status"
              aria-label="Sent transcription"
              className="text-sm wrap-anywhere"
            >
              {sentText}
            </p>
          </section>
        </div>
      </PageShell>
    </ErrorFeedbackProvider>
  );
};
