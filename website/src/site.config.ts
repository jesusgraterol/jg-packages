import { resolve } from 'node:path';

import type { IPackageCatalogEntry } from './utilities/package-catalog/index.ts';

/*
 * The site's presentation of every listed package under ../packages. Names and versions come from
 * each package.json; the build fails when this catalog and the packages disagree.
 */
export const PACKAGE_CATALOG: Readonly<Record<string, IPackageCatalogEntry>> = {
  'jg-exception': {
    title: 'Errors',
    description:
      'Errors with codes for every package: a message and code wire format, an Exception class, decoding helpers, and test assertions.',
    icon: 'octagon-alert',
    runtimes: ['universal'],
    previousPackages: ['error-message-utils'],
    order: 1,
  },
  'jg-api-response': {
    title: 'API envelopes',
    description:
      'Build and recognise the success, data, and error envelope that services exchange over HTTP, including envelopes parsed from JSON.',
    icon: 'braces',
    runtimes: ['universal'],
    previousPackages: ['api-response-utils'],
    order: 2,
  },
  'jg-utilities': {
    title: 'Utilities',
    description:
      'Validations, formatters, secure random generators, pagination cursors, and collection, async, and environment helpers.',
    icon: 'wrench',
    runtimes: ['universal'],
    previousPackages: ['web-utils-kit'],
    order: 3,
  },
  'jg-bignumber': {
    title: 'Decimal math',
    description:
      'Exact decimal math on bignumber.js: rounding modes, formatting, and financial calculations such as percentage changes.',
    icon: 'calculator',
    runtimes: ['universal'],
    previousPackages: ['bignumber-utils'],
    order: 4,
  },
  'jg-fetch': {
    title: 'HTTP requests',
    description:
      'A fetch wrapper that never throws: timeouts, retries that honour Retry-After, response size caps, and API envelopes.',
    icon: 'globe',
    runtimes: ['universal'],
    previousPackages: ['fetch-request-browser', 'fetch-request-node'],
    order: 5,
  },
  'jg-storage': {
    title: 'Browser storage',
    description:
      'Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for pages and workers alike.',
    icon: 'database',
    runtimes: ['browser'],
    previousPackages: ['browser-keyval-stores'],
    order: 6,
  },
  'jg-sw': {
    title: 'Service workers',
    description:
      'A generated caching worker with a Vite plugin and CLI, plus registration, updates that reload once, and app installation.',
    icon: 'cloud-off',
    runtimes: ['browser', 'node'],
    previousPackages: ['sw-service', 'sw-builder'],
    order: 7,
  },
  'jg-fs': {
    title: 'Filesystem',
    description:
      'Filesystem helpers, async and sync: path checks, directories, text and JSON files, atomic writes, and bounded reads.',
    icon: 'folder-open',
    runtimes: ['node'],
    previousPackages: ['fs-utils-async', 'fs-utils-sync'],
    order: 8,
  },
  'jg-process': {
    title: 'Child processes',
    description:
      'Run and stop child processes without a shell: timeouts, output limits, abort signals, and whole process trees.',
    icon: 'cpu',
    runtimes: ['node'],
    previousPackages: ['node-process-utils'],
    order: 9,
  },
};

// the workspace's packages, which the catalog and the package pages read; the site builds from website/
export const PACKAGES_DIRECTORY = resolve(process.cwd(), '..', 'packages');

export const SITE_CONFIG = {
  author: {
    name: 'Jesus Graterol',
    twitterHandle: '@jesus__graterol',
    url: 'https://jesusgraterol.dev/',
  },
  defaultDescription:
    'Small, focused TypeScript packages for errors, HTTP requests, storage, service workers, files, and processes, with docs for people and agents.',
  language: 'en',
  license: 'MIT',
  name: 'JG Packages',
  navigation: [
    { href: '/#packages', label: 'Packages' },
    { href: '/#principles', label: 'Principles' },
    { href: '/#agents', label: 'For agents' },
  ],
  npmUrl: 'https://www.npmjs.com/package/',
  // the author's other sites, which share this site's foundation
  relatedSites: [
    { href: 'https://jesusgraterol.dev/', label: 'jesusgraterol.dev' },
    { href: 'https://agenticcoding.jesusgraterol.dev/', label: 'Agentic Coding' },
    { href: 'https://jg-skills.jesusgraterol.dev/', label: 'JG Skills' },
  ],
  repositoryUrl: 'https://github.com/jesusgraterol/jg-packages',
  storageKeys: {
    packageManager: 'jg-packages-package-manager',
    theme: 'jg-packages-theme',
  },
  themeColors: {
    dark: '#1e2939',
    light: '#fefdfb',
  },
  url: 'https://jg-packages.jesusgraterol.dev',
} as const;
