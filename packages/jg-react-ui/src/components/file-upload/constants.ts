import type { IFileUploadStatus } from 'jg-react';

// default visible copy keeps the component usable without product-specific labels.
export const FILE_UPLOAD_DEFAULT_BROWSE_LABEL = 'Choose files';
export const FILE_UPLOAD_DEFAULT_CANCEL_ALL_LABEL = 'Cancel all';
export const FILE_UPLOAD_DEFAULT_DROP_ZONE_LABEL = 'Drag and drop files here';
export const FILE_UPLOAD_DEFAULT_HIDE_UPLOAD_AREA_LABEL = 'Hide upload area';
export const FILE_UPLOAD_DEFAULT_LABEL = 'Upload files';
export const FILE_UPLOAD_DEFAULT_SHOW_UPLOAD_AREA_LABEL = 'Show upload area';
export const FILE_UPLOAD_DEFAULT_START_UPLOADS_LABEL = 'Start uploads';

// lifecycle labels communicate queue state without relying on color or animation.
export const FILE_UPLOAD_STATUS_LABELS = {
  validating: 'Validating',
  queued: 'Queued',
  uploading: 'Uploading',
  processing: 'Processing',
  succeeded: 'Uploaded',
  failed: 'Upload failed',
  canceled: 'Canceled',
  rejected: 'Not accepted',
} satisfies Record<IFileUploadStatus, string>;
