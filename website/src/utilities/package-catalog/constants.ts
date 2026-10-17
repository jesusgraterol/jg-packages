import type { IRuntime } from './types.ts';

// packages published from packages/ that the site never lists
export const UNLISTED_PACKAGES: readonly string[] = ['jg-personal-astro-ui'];

// how each runtime is named on badges and in the home page's groups
export const RUNTIMES: Record<IRuntime, { label: string; heading: string; summary: string }> = {
  universal: {
    label: 'Universal',
    heading: 'Browsers and Node.js',
    summary: 'Typechecked against both runtimes, so they use only the globals both have.',
  },
  browser: {
    label: 'Browser',
    heading: 'Browsers and workers',
    summary: 'For pages and service workers, and safe to import during server rendering.',
  },
  node: {
    label: 'Node.js',
    heading: 'Node.js',
    summary: 'For servers, command-line tools, and build scripts.',
  },
};

// the summary length search engines show in full
export const DESCRIPTION_LENGTH = { min: 70, max: 160 } as const;

// the length of a useWhen sentence, short enough to keep each AGENTS.md line readable
export const USE_WHEN_LENGTH = { min: 40, max: 140 } as const;
