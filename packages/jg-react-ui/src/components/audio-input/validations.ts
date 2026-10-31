import { z } from 'zod';

// audio submission modes validate only the authored text required by their selected action.
export const AudioInputTranscriptionFormSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('transcribe-and-send'),
    transcription: z.string(),
  }),
  z.strictObject({
    action: z.literal('send'),
    transcription: z.string().trim().min(1, 'Enter a transcription before sending.'),
  }),
]);
