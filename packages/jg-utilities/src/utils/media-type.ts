import type { IDetectableMediaType } from './types.js';

// reads bytes as Latin-1 text, each byte one character, for comparing ASCII signatures
const readAscii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end));

// whether the bytes start with these exact values
const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);

// an MPEG audio frame's sync bits, with a layer that isn't the reserved one, as an MP3 starts
const isMpegAudioFrame = (bytes: Uint8Array): boolean =>
  bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0 && ((bytes[1] ?? 0) & 0x06) !== 0;

// how each media type's content starts
const SIGNATURES: Readonly<Record<IDetectableMediaType, (bytes: Uint8Array) => boolean>> = {
  'image/png': (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  'image/gif': (bytes) => ['GIF87a', 'GIF89a'].includes(readAscii(bytes, 0, 6)),
  'image/webp': (bytes) => readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WEBP',
  'image/x-icon': (bytes) => startsWith(bytes, [0x00, 0x00, 0x01, 0x00]),
  'application/pdf': (bytes) => readAscii(bytes, 0, 5) === '%PDF-',
  'audio/webm': (bytes) => startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/ogg': (bytes) => readAscii(bytes, 0, 4) === 'OggS',
  'audio/mp4': (bytes) => readAscii(bytes, 4, 8) === 'ftyp',
  'audio/mpeg': (bytes) => readAscii(bytes, 0, 3) === 'ID3' || isMpegAudioFrame(bytes),
  'audio/wav': (bytes) => readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 12) === 'WAVE',
};

/**
 * Names the media type of content from its leading bytes, never from a name or a type someone
 * claims, among the types a caller accepts: PNG, JPEG, GIF, WebP and ICO images, PDF, and WebM,
 * Ogg, MP4, MP3 and WAV audio. A WebM or MP4 file holding video reads as its audio type, since
 * their first bytes name only the container. The first accepted type whose signature matches wins.
 * @param bytes The content, or at least its first 16 bytes.
 * @param allowed The media types to look for.
 * @returns The matching type, or null when the content is none of them.
 * @example
 * import { detectMediaType } from 'jg-utilities';
 *
 * const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
 * detectMediaType(png, ['image/png', 'image/jpeg']); // => 'image/png'
 * detectMediaType(png, ['application/pdf']); // => null
 */
export const detectMediaType = <TType extends IDetectableMediaType>(
  bytes: Uint8Array,
  allowed: readonly TType[],
): TType | null => allowed.find((type) => SIGNATURES[type](bytes)) ?? null;
