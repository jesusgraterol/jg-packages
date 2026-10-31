import { expect, test } from '@playwright/test';
import { ERRORS as baseErrors } from 'jg-react-ui/errors';
import { ERRORS } from 'jg-personal-react-ui';

test(
  'personal errors share the base catalog and retain the documented public codes',
  { tag: '@full' },
  () => {
    expect(ERRORS).toBe(baseErrors);
    expect(Object.entries(ERRORS).map(([name, code]) => ({ name, code }))).toEqual(
      expect.arrayContaining([
        { name: 'AUDIO_INPUT_MAX_BYTES_EXCEEDED', code: 'AUDIO_INPUT_MAX_BYTES_EXCEEDED' },
        { name: 'AUDIO_INPUT_RECORDING_FAILED', code: 'AUDIO_INPUT_RECORDING_FAILED' },
        { name: 'AUDIO_INPUT_UNSUPPORTED', code: 'AUDIO_INPUT_UNSUPPORTED' },
        {
          name: 'AUDIO_INPUT_MICROPHONE_ACCESS_FAILED',
          code: 'AUDIO_INPUT_MICROPHONE_ACCESS_FAILED',
        },
        {
          name: 'AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED',
          code: 'AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED',
        },
        {
          name: 'AUDIO_INPUT_TRANSCRIPTION_INVALID_RESULT',
          code: 'AUDIO_INPUT_TRANSCRIPTION_INVALID_RESULT',
        },
        { name: 'AUDIO_INPUT_TRANSCRIPTION_FAILED', code: 'AUDIO_INPUT_TRANSCRIPTION_FAILED' },
      ]),
    );
  },
);
