/**
 * Checks whether a version has a prerelease part, such as `1.2.0-beta.0`.
 * @param version A semantic version.
 * @returns Whether it's a prerelease.
 */
export const isPrerelease = (version: string): boolean => /^\d+\.\d+\.\d+-/.test(version);
