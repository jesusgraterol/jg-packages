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
      'Coded errors for every jg package: an Exception with a stable code and JSON data, message extraction, code checks, and test assertions.',
    useWhen:
      'Use for every error you throw or inspect: coded Exceptions with JSON data, instead of plain Errors and message matching.',
    icon: 'octagon-alert',
    runtimes: ['universal'],
    order: 1,
  },
  'jg-api-response': {
    title: 'API envelopes',
    description:
      'Build and recognise the success, data, and error envelope that services exchange over HTTP, with errors as a code, a message, and data.',
    useWhen:
      'Use to build or recognise the JSON envelope an HTTP API returns, with errors as a code, a message, and data.',
    icon: 'braces',
    runtimes: ['universal'],
    order: 2,
  },
  'jg-utilities': {
    title: 'Utilities',
    description:
      'Validations, formatters, secure random generators, pagination cursors, and collection, async, and environment helpers.',
    useWhen:
      'Use before writing a validation, formatter, random id, pagination cursor, or collection, async, or environment helper.',
    icon: 'wrench',
    runtimes: ['universal'],
    order: 3,
  },
  'jg-bignumber': {
    title: 'Decimal math',
    description:
      'Exact decimal math on bignumber.js: rounding modes, formatting, and financial calculations such as percentage changes.',
    useWhen:
      'Use for money and any other decimal math that must be exact, instead of JavaScript numbers.',
    icon: 'calculator',
    runtimes: ['universal'],
    order: 4,
  },
  'jg-fetch': {
    title: 'HTTP requests',
    description:
      'A fetch wrapper that never throws: timeouts, retries that honour Retry-After, response size caps, and API envelopes.',
    useWhen:
      'Use for every HTTP request instead of fetch: timeouts, retries, size limits, and a result that never throws.',
    icon: 'globe',
    runtimes: ['universal'],
    order: 5,
  },
  'jg-storage': {
    title: 'Browser storage',
    description:
      'Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for pages and workers alike.',
    useWhen:
      'Use to keep typed data in localStorage, sessionStorage, IndexedDB, or memory, from pages and workers.',
    icon: 'database',
    runtimes: ['browser'],
    order: 6,
  },
  'jg-sw': {
    title: 'Service workers',
    description:
      'A generated caching worker with a Vite plugin and CLI, plus registration, updates that reload once, and app installation.',
    useWhen:
      'Use to make a Vite app work offline: a generated service worker, its registration, updates, and installation.',
    icon: 'cloud-off',
    runtimes: ['browser', 'node'],
    order: 7,
  },
  'jg-fs': {
    title: 'Filesystem',
    description:
      'Filesystem helpers, async and sync: path checks, directories, text and JSON files, atomic writes, and bounded reads.',
    useWhen:
      'Use for file and directory work in Node.js: JSON files, atomic writes, bounded reads, and path checks.',
    icon: 'folder-open',
    runtimes: ['node'],
    order: 8,
  },
  'jg-process': {
    title: 'Child processes',
    description:
      'Run and stop child processes without a shell: timeouts, output limits, abort signals, and whole process trees.',
    useWhen:
      'Use to run child processes in Node.js without a shell, with timeouts, output limits, and stopping whole trees.',
    icon: 'cpu',
    runtimes: ['node'],
    order: 9,
  },
  'jg-clipboard': {
    title: 'Clipboard',
    description:
      'Copy and read text, HTML, and images on the browser clipboard, with support detection and coded errors that say why the browser refused.',
    useWhen:
      'Use to copy or read text, HTML, or images in the browser, with errors that say why the browser refused.',
    icon: 'clipboard',
    runtimes: ['browser'],
    order: 10,
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
    'Small, tested TypeScript packages for coding agents to build on: errors, HTTP requests, storage, files, and processes, with docs inside each one.',
  language: 'en',
  license: 'MIT',
  name: 'jg-packages',
  navigation: [
    { href: '/#packages', label: 'Packages' },
    { href: '/#why', label: 'Why' },
    { href: '/#agents-md', label: 'AGENTS.md' },
    { href: '/#agents', label: 'Agent docs' },
  ],
  npmUrl: 'https://www.npmjs.com/package/',
  // the author's other sites, which share this site's foundation
  relatedSites: [
    { href: 'https://jesusgraterol.dev/', label: 'jesusgraterol.dev' },
    { href: 'https://agenticcoding.jesusgraterol.dev/', label: 'Agentic Coding' },
    { href: 'https://jg-skills.jesusgraterol.dev/', label: 'jg-skills' },
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
