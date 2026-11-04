// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { detectMediaType } from './media-type.js';
import type { IDetectableMediaType } from './types.js';

// every type detectMediaType recognizes
const ALL: IDetectableMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'application/pdf',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
];

// bytes from Latin-1 text, each character one byte
const ascii = (text: string): number[] => [...text].map((character) => character.charCodeAt(0));

// a file's first bytes, padded to 16, as a caller reads them
const head = (bytes: number[]): Uint8Array => {
  const padded = new Uint8Array(16);
  padded.set(bytes);
  return padded;
};

describe('detectMediaType', () => {
  test.each([
    ['a PNG', [0x89, ...ascii('PNG\r\n\u001a\n')], 'image/png'],
    ['a JPEG', [0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    ['a GIF 87a', ascii('GIF87a'), 'image/gif'],
    ['a GIF 89a', ascii('GIF89a'), 'image/gif'],
    ['a WebP', [...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP')], 'image/webp'],
    ['an ICO', [0x00, 0x00, 0x01, 0x00], 'image/x-icon'],
    ['a PDF', ascii('%PDF-1.7'), 'application/pdf'],
    ['a WebM', [0x1a, 0x45, 0xdf, 0xa3], 'audio/webm'],
    ['an Ogg', ascii('OggS'), 'audio/ogg'],
    ['an MP4', [0, 0, 0, 0x20, ...ascii('ftypM4A ')], 'audio/mp4'],
    ['an MP3 with ID3 tags', ascii('ID3'), 'audio/mpeg'],
    ['an MP3 frame', [0xff, 0xfb, 0x90], 'audio/mpeg'],
    ['a WAV', [...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WAVE')], 'audio/wav'],
  ] as const)('detectMediaType(%s) -> %s', (_case, bytes, expected) => {
    expect(detectMediaType(head([...bytes]), ALL)).toBe(expected);
  });

  test('looks only for the types it is given', () => {
    const png = head([0x89, ...ascii('PNG\r\n\u001a\n')]);
    expect(detectMediaType(png, ['image/png', 'image/jpeg'])).toBe('image/png');
    expect(detectMediaType(png, ['application/pdf'])).toBeNull();
    expect(detectMediaType(png, [])).toBeNull();
  });

  test.each([
    ['empty content', []],
    ['text', ascii('Hello, world')],
    ['a JPEG cut after two bytes', [0xff, 0xd8]],
    ['a RIFF of another kind', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('AVI ')]],
    ['an MPEG frame with the reserved layer', [0xff, 0xe0]],
    // AAC's ADTS frames use the layer MPEG audio reserves, so they aren't MP3
    ['an AAC frame', [0xff, 0xf1]],
  ])('detectMediaType(%s) -> null', (_case, bytes) => {
    expect(detectMediaType(new Uint8Array(bytes), ALL)).toBeNull();
  });

  test('reads a Node.js Buffer, which is a Uint8Array', () => {
    expect(detectMediaType(Buffer.from('%PDF-1.4'), ['application/pdf'])).toBe('application/pdf');
  });
});
