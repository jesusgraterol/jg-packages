import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import type { IDownloadBlobOptions, IDownloadJsonOptions } from './types.js';
import { unrefTimer } from './utilities.js';

// the parts of a link element a download uses
type IDownloadLink = {
  href: string;
  download: string;
  rel: string;
  style: { display: string };
  click: () => void;
  remove: () => void;
};

/*
 * The browser globals a download uses. The package runs in browsers and Node.js, so they're read
 * from globalThis without assuming they exist.
 */
type IDownloadGlobals = {
  document?: {
    createElement: (tagName: 'a') => IDownloadLink;
    body: { append: (node: IDownloadLink) => void } | null;
  };
};

// the global object, typed with the browser globals that may be missing
const downloadGlobals = globalThis as unknown as IDownloadGlobals;

// how long a download's object URL stays valid when the options don't say, so a slow browser
// still reads it
const DEFAULT_REVOKE_DELAY_SECONDS = 40;

/**
 * Saves a Blob as a file in a browser, through a temporary hidden link that's added to the page,
 * clicked, and removed. The object URL is revoked only after `revokeDelaySeconds`, 40 by default,
 * because revoking it right after the click can cancel the download in some browsers. Without a
 * document, such as in Node.js, it does nothing.
 * @param blob The file's contents.
 * @param fileName The name the browser suggests.
 * @param options How long the object URL stays valid.
 * @returns Whether the download started: false without a document or a body.
 * @example
 * import { downloadBlob } from 'jg-utilities';
 *
 * downloadBlob(new Blob(['id,name\n1,Ada\n'], { type: 'text/csv' }), 'users.csv'); // false in Node.js
 */
export const downloadBlob = (
  blob: Blob,
  fileName: string,
  { revokeDelaySeconds = DEFAULT_REVOKE_DELAY_SECONDS }: IDownloadBlobOptions = {},
): boolean => {
  const { document: page } = downloadGlobals;
  if (page === undefined || page.body === null) {
    return false;
  }
  const url = URL.createObjectURL(blob);
  const link = page.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  page.body.append(link);
  link.click();
  link.remove();
  unrefTimer(
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, revokeDelaySeconds * 1_000),
  );
  return true;
};

/**
 * Saves a value as a pretty-printed JSON file in a browser, ending in a newline, with
 * downloadBlob. The value is serialized first, so one that can't be throws wherever it runs.
 * @param value The value, such as a settings export.
 * @param fileName The name the browser suggests, such as `settings.json`.
 * @param options The indentation, 2 spaces by default.
 * @returns Whether the download started: false without a document or a body.
 * @example
 * import { downloadJson } from 'jg-utilities';
 *
 * downloadJson({ theme: 'dark' }, 'settings.json'); // => false
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: The value couldn't be serialized as JSON.
 */
export const downloadJson = (
  value: unknown,
  fileName: string,
  { space = 2 }: IDownloadJsonOptions = {},
): boolean => {
  let text: string | undefined;
  try {
    text = JSON.stringify(value, null, space);
  } catch (error) {
    throw new Exception("The value couldn't be serialized as JSON.", {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
      cause: error,
    });
  }
  // JSON.stringify gives undefined for undefined, a function, or a symbol
  if (text === undefined) {
    throw new Exception("The value couldn't be serialized as JSON.", {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
    });
  }
  return downloadBlob(new Blob([`${text}\n`], { type: 'application/json' }), fileName);
};
