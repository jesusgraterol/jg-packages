# Errors

| Code                                | Message                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `THEME_PROVIDER_MISSING`            | useTheme must be used within a ThemeProvider                                                                    |
| `UI_PREFERENCES_STORAGE_ID_INVALID` | UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens. |

Audio recording failures are delivered to `onRecordingError`; transcription and result-delivery failures are delivered to `onTranscriptionError`. Provider codes remain distinct when a coded provider failure is supplied. The callback receives diagnostics; visible feedback uses the nearest scoped resolver. Canceled permission/transcription adapters return to idle without an outage alert; their diagnostic callback remains available. Wrapped diagnostics may append the extracted cause after the stable message below.

| Code                                       | Stable message                                        |
| ------------------------------------------ | ----------------------------------------------------- |
| `AUDIO_INPUT_MAX_BYTES_EXCEEDED`           | Recording stopped because it reached the audio limit. |
| `AUDIO_INPUT_RECORDING_FAILED`             | Audio recording failed.                               |
| `AUDIO_INPUT_UNSUPPORTED`                  | Audio recording is not supported in this browser.     |
| `AUDIO_INPUT_MICROPHONE_ACCESS_FAILED`     | Microphone access failed.                             |
| `AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED`  | Transcription could not be sent.                      |
| `AUDIO_INPUT_TRANSCRIPTION_INVALID_RESULT` | Audio transcription returned an invalid result.       |
| `AUDIO_INPUT_TRANSCRIPTION_FAILED`         | Audio transcription failed.                           |

`FileUpload`, `FileUploadDialog`, and `ImageUploadField` propagate `INVALID_FILE_UPLOAD_POLICY` from `jg-react`. Its canonical messages are documented in [jg-react's error reference](https://unpkg.com/jg-react@0.6.0/errors/README.md) and repeated in these components' API `@throws` contracts.

`YouTubeVideo` propagates `INVALID_YOUTUBE_VIDEO_ID`: The YouTube video id must be 11 letters, digits, '-', or '_'. The canonical dependency contract is in [jg-utilities' error reference](https://unpkg.com/jg-utilities@1.7.2/errors/README.md). Use `parseYouTubeVideoUrl` at authored URL boundaries before supplying its branded identifier.
