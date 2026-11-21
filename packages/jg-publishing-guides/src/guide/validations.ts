import { Exception } from 'jg-exception';

import type {
  IPublishingChannel,
  IPublishingGuide,
  IPublishingGuideFile,
  IPublishingGuideLocale,
  IPublishingGuideStep,
} from './types.js';

// stable public code for presentation input failures
export const ERRORS = { INVALID_PUBLISHING_GUIDE: 'INVALID_PUBLISHING_GUIDE' } as const;

const CHANNELS = new Set<IPublishingChannel>([
  'x',
  'linkedin',
  'instagram',
  'tiktok',
  'facebook',
  'threads',
  'bluesky',
  'youtube',
  'github',
  'post',
]);
const PATH_COMPONENT = /^[a-z0-9][a-z0-9._-]*$/u;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/u;
const CONTROL_CHARACTERS = /[^\P{Cc}\n\r\t]/u;
const MAX_FILES = 64;
const MAX_COPY_BYTES = 64 * 1024;
const MAX_PREVIEW_DIMENSION = 16_384;

/**
 * Rejects a broken presentation contract with an operation-specific diagnostic.
 * @param detail The failed validation.
 */
export const invalidGuide: (detail: string) => never = (detail) => {
  throw new Exception(`The publishing guide input is invalid.: ${detail}`, {
    code: ERRORS.INVALID_PUBLISHING_GUIDE,
  });
};

const isText = (text: unknown): text is string =>
  typeof text === 'string' && text.trim() !== '' && !CONTROL_CHARACTERS.test(text);

const isPortablePath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.length <= 160 &&
  path
    .split('/')
    .every(
      (part) =>
        part.length <= 64 &&
        PATH_COMPONENT.test(part) &&
        !part.endsWith('.') &&
        !RESERVED_NAME.test(part),
    );

const isDimension = (size: number): boolean =>
  Number.isSafeInteger(size) && size > 0 && size <= MAX_PREVIEW_DIMENSION;

/**
 * Checks the selected local filenames and preview attributes without accessing the files.
 * @param files The selected files.
 * @returns A file lookup by portable output path.
 */
const indexFiles = (files: IPublishingGuideFile[]): Map<string, IPublishingGuideFile> => {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES)
    invalidGuide('Select between 1 and 64 files.');
  const names = ['start-here.html', 'readme.txt'];
  const selected = new Map<string, IPublishingGuideFile>();
  for (const file of files) {
    if (
      !file ||
      !isText(file.label) ||
      !isText(file.details) ||
      !isPortablePath(file.path) ||
      !['file', 'image', 'video'].includes(file.kind)
    )
      invalidGuide('Every file needs portable output, a known kind and literal labels.');
    if (
      names.some(
        (name) =>
          name === file.path ||
          name.startsWith(`${file.path}/`) ||
          file.path.startsWith(`${name}/`),
      )
    )
      invalidGuide('File paths collide or replace a viewing guide.');
    if (file.kind !== 'file' && (!isDimension(file.width) || !isDimension(file.height)))
      invalidGuide('Images and videos need positive pixel dimensions.');
    selected.set(file.path, file);
    names.push(file.path);
  }
  return selected;
};

/**
 * Confirms that a channel's ID and every generated anchor remain unique.
 * @param step The channel step.
 * @param ids The generated document IDs.
 * @returns The channel's ID.
 */
const registerStep = (step: IPublishingGuideStep, ids: Set<string>): string => {
  const id = step.id ?? step.channel;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id) || id.length > 64)
    invalidGuide('Channel IDs must be portable lowercase identifiers.');
  const suffixes = [
    '',
    '-start',
    '-copy',
    '-media',
    '-review',
    '-caption',
    '-caption-status',
    '-title',
    '-title-status',
  ];
  if (step.documentTitle === undefined) {
    for (let index = 1; index <= step.media.length; index += 1)
      suffixes.push(`-alt-${index}`, `-alt-${index}-status`);
  }
  for (const suffix of suffixes) {
    const anchor = id + suffix;
    if (ids.has(anchor)) invalidGuide('Channel IDs or step anchors collide.');
    ids.add(anchor);
  }
  return id;
};

/**
 * Validates the relationships the page renders. Selection and publication authority stay upstream.
 * @param guide The publishing presentation.
 * @param copy Literal text by selected file path.
 * @param locale The supplied interface language.
 */
export const validateGuide = (
  guide: IPublishingGuide,
  copy: ReadonlyMap<string, string>,
  locale: IPublishingGuideLocale,
): void => {
  if (
    !guide ||
    !isText(guide.title) ||
    !isText(guide.summary) ||
    (locale !== 'en' && locale !== 'es')
  )
    invalidGuide('A title, summary and supported locale are required.');
  const files = indexFiles(guide.files);
  if (!(copy instanceof Map)) invalidGuide('Supply literal copy as a map of selected files.');
  for (const [path, text] of copy) {
    if (
      typeof path !== 'string' ||
      !files.has(path) ||
      !isText(text) ||
      Buffer.byteLength(text) > MAX_COPY_BYTES
    )
      invalidGuide('Copy must be selected nonblank text of at most 64 KiB per file.');
  }

  const { walkthrough } = guide;
  if (walkthrough === undefined) return;
  if (!Array.isArray(walkthrough) || walkthrough.length < 1 || walkthrough.length > MAX_FILES)
    invalidGuide('Supply between 1 and 64 channel steps.');

  const ids = new Set<string>();
  const previous = new Map<string, IPublishingGuideStep>();
  for (const step of walkthrough) {
    if (
      !step ||
      !CHANNELS.has(step.channel) ||
      !Array.isArray(step.media) ||
      step.media.length > MAX_FILES ||
      (step.label !== undefined && !isText(step.label))
    )
      invalidGuide('Each step needs a supported channel and an upload list.');
    const id = registerStep(step, ids);
    if (step.repostOf !== undefined) {
      const original = previous.get(step.repostOf);
      if (
        step.channel !== 'instagram' ||
        !original ||
        original.channel !== 'instagram' ||
        original.repostOf !== undefined ||
        original.id !== step.repostOf ||
        step.media.length !== 0 ||
        (step.caption !== undefined && !copy.has(step.caption)) ||
        step.postTitle !== undefined ||
        step.documentTitle !== undefined
      )
        invalidGuide(
          'Reposts must reference an earlier Instagram original and select no upload media.',
        );
    } else {
      if (
        !copy.has(step.caption) ||
        step.media.length < 1 ||
        new Set(step.media).size !== step.media.length
      )
        invalidGuide('Each original step needs a selected caption and unique upload files.');
      if (
        step.postTitle !== undefined &&
        (step.channel !== 'tiktok' || step.postTitle === step.caption || !copy.has(step.postTitle))
      )
        invalidGuide('A TikTok title must select separate literal copy.');
      if (step.documentTitle !== undefined) {
        if (
          !isText(step.documentTitle) ||
          step.media.length !== 1 ||
          !step.media[0]?.endsWith('.pdf') ||
          files.get(step.media[0])?.kind !== 'file'
        )
          invalidGuide('A document step needs a title and one selected PDF.');
      } else if (!step.media.every((path) => files.get(path)?.kind === 'image')) {
        invalidGuide('An image upload step must refer to selected images.');
      }
    }
    previous.set(id, step);
  }
};
