// the longest X-Hub-Signature-256 header: 'sha256=' and 64 hexadecimal characters
export const MAX_SIGNATURE_HEADER_LENGTH = 71;

// an X-Hub-Signature-256 header
export const SIGNATURE_HEADER_PATTERN = /^sha256=[0-9a-f]{64}$/;
