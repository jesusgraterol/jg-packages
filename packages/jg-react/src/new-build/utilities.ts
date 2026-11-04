/**
 * Reads the path of the entry script a page loads from the build's hashed assets, which names the
 * build, since a new build's entry has another hash.
 * @param page The page, the open one or one parsed from the server's answer.
 * @param assetPrefix The folder of the build's hashed scripts.
 * @returns The script's path, or null for a page without one, such as a development server's.
 */
export const readEntryScript = (page: Document, assetPrefix: string): string | null => {
  for (const script of page.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')) {
    // src reads the resolved address, which a parsed page resolves against the open page's
    const path = new URL(script.src).pathname;
    if (path.startsWith(assetPrefix)) {
      return path;
    }
  }
  return null;
};

/**
 * Tells whether the entry page the server answers with loads another build than the open page.
 * An answer that isn't the page, such as a sign-in page a proxy serves, names no build.
 * @param current The open page's entry script.
 * @param served The entry page the server answered with.
 * @param assetPrefix The folder of the build's hashed scripts.
 * @returns Whether the server serves another build.
 */
export const isNewerBuild = (current: string, served: string, assetPrefix: string): boolean => {
  const entry = readEntryScript(new DOMParser().parseFromString(served, 'text/html'), assetPrefix);
  return entry !== null && entry !== current;
};
