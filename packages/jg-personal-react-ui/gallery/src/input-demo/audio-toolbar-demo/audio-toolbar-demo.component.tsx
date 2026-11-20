import { useState } from 'react';

import { AudioInput, Label, Textarea } from 'jg-personal-react-ui';

/** Exercises the published recorder toolbar inside a compact message composer. */
export const AudioToolbarDemo = () => {
  const [draft, setDraft] = useState('');

  return (
    <section
      aria-labelledby="audio-toolbar-title"
      className="grid min-w-0 gap-3"
    >
      <h2
        id="audio-toolbar-title"
        className="text-xl font-semibold"
      >
        Composer recording
      </h2>
      <div className="border-border rounded-xl border p-2">
        <Label
          htmlFor="audio-toolbar-draft"
          className="sr-only"
        >
          Message
        </Label>
        <Textarea
          id="audio-toolbar-draft"
          placeholder="Message the agent"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <div className="mt-2">
          <AudioInput
            presentation="inline"
            inlineLayout="toolbar"
            triggerAriaLabel="Record message"
            transcribe={() => Promise.resolve('A recorded message for the composer.')}
            onTranscriptionApply={(text) => setDraft(text)}
            onTranscriptionResult={() => setDraft('')}
          />
        </div>
      </div>
    </section>
  );
};
