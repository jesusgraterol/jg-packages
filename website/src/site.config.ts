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
    icon: 'octagon-alert',
    runtimes: ['universal'],
    order: 1,
  },
  'jg-api-response': {
    title: 'API envelopes',
    description:
      'Build and recognise the success, data, and error envelope that services exchange over HTTP, with errors as a code, a message, and data.',
    icon: 'braces',
    runtimes: ['universal'],
    order: 2,
  },
  'jg-utilities': {
    title: 'Utilities',
    description:
      'Validations, formatters, secure random generators, pagination cursors, and collection, async, and environment helpers.',
    icon: 'wrench',
    runtimes: ['universal'],
    order: 3,
  },
  'jg-bignumber': {
    title: 'Decimal math',
    description:
      'Exact decimal math on bignumber.js: rounding modes, formatting, and financial calculations such as percentage changes.',
    icon: 'calculator',
    runtimes: ['universal'],
    order: 4,
  },
  'jg-fetch': {
    title: 'HTTP requests',
    description:
      'A fetch wrapper that never throws: timeouts, retries that honour Retry-After, response size caps, and API envelopes.',
    icon: 'globe',
    runtimes: ['universal'],
    order: 5,
  },
  'jg-storage': {
    title: 'Browser storage',
    description:
      'Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for pages and workers alike.',
    icon: 'database',
    runtimes: ['browser'],
    order: 6,
  },
  'jg-sw': {
    title: 'Service workers',
    description:
      'A generated caching worker with a Vite plugin and CLI, plus registration, updates that reload once, and app installation.',
    icon: 'cloud-off',
    runtimes: ['browser', 'node'],
    order: 7,
  },
  'jg-fs': {
    title: 'Filesystem',
    description:
      'Filesystem helpers, async and sync: path checks, directories, text and JSON files, atomic writes, and bounded reads.',
    icon: 'folder-open',
    runtimes: ['node'],
    order: 8,
  },
  'jg-process': {
    title: 'Child processes',
    description:
      'Run and stop child processes without a shell: timeouts, output limits, abort signals, and whole process trees.',
    icon: 'cpu',
    runtimes: ['node'],
    order: 9,
  },
  'jg-clipboard': {
    title: 'Clipboard',
    description:
      'Copy and read text, HTML, and images on the browser clipboard, with support detection and coded errors that say why the browser refused.',
    icon: 'clipboard',
    runtimes: ['browser'],
    order: 10,
  },
  'jg-env': {
    title: 'Environment',
    description:
      'Strict environment variable readers for process.env or import.meta.env, plus secret files, with errors that name the key and never the value.',
    icon: 'key-round',
    runtimes: ['universal'],
    order: 11,
  },
  'jg-postgres': {
    title: 'PostgreSQL',
    description:
      'node-postgres helpers: transactions that report an unknown commit, advisory locks, SQLSTATE checks, cursor pages, and ordered lists.',
    icon: 'table-2',
    runtimes: ['node'],
    order: 12,
  },
};

// the workspace's packages, which the catalog and the package pages read; the site builds from website/
export const PACKAGES_DIRECTORY = resolve(process.cwd(), '..', 'packages');

export const SITE_CONFIG = {
  // how a project sets its agent up to use the packages, through jg-skills, which owns both
  // destinations; docs/website.md has the launch order that keeps these links live
  agentSetup: {
    installCommand: 'npx skills add jesusgraterol/jg-skills --skill jg-packages -y',
    policyUrl:
      'https://github.com/jesusgraterol/jg-skills/blob/main/skills/jg-packages/assets/agents-section.md',
    skillUrl: 'https://jg-skills.jesusgraterol.dev/skills/jg-packages/',
  },
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
    { href: '/#setup', label: 'Agent setup' },
    { href: '/#agents', label: 'Agent docs' },
  ],
  npmUrl: 'https://www.npmjs.com/package/',
  // the image social cards show for every page, written by scripts/generate-open-graph.ts
  openGraph: {
    height: 630,
    image: '/og/jg-packages.png',
    imageAlt: 'jg-packages: tested TypeScript packages for coding agents',
    imageType: 'image/png',
    locale: 'en_US',
    width: 1200,
  },
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
