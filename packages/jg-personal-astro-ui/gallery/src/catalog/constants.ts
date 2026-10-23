import type { IGalleryExample, IGalleryPage } from './types.ts';

// every page uses the shared frame and head; selectors also work in an installed consumer
export const GALLERY_PAGES: IGalleryPage[] = [
  {
    href: '/foundations/',
    label: 'Foundations',
    description: 'Brand, tokens, actions, and surfaces.',
  },
  {
    href: '/interactions/',
    label: 'Interactions',
    description: 'Tabs, dialogs, search, and copying.',
  },
  {
    href: '/documentation/',
    label: 'Documentation',
    description: 'Reading layouts and rich prose.',
  },
  {
    href: '/technical-content/',
    label: 'Technical content',
    description: 'Code, diffs, and commands.',
  },
];

export const GALLERY_EXAMPLES: IGalleryExample[] = [
  ...[
    'agentic-coding-mark',
    'badge',
    'button',
    'card',
    'hero-backdrop',
    'icon-tile',
    'jg-mark',
    'link-card',
    'stack',
    'text-link',
    'new-tab-marker',
  ].map((subpath) => ({ subpath, path: '/foundations/', selector: `[data-example="${subpath}"]` })),
  { subpath: 'container', path: '/foundations/', selector: '.jg-container' },
  ...[
    'accordion',
    'copy-button',
    'dialog',
    'package-manager-tabs',
    'segmented-control',
    'tabs',
  ].map((subpath) => ({
    subpath,
    path: '/interactions/',
    selector: `[data-example="${subpath}"]`,
  })),
  ...[
    'breadcrumb',
    'callout',
    'documentation-shell',
    'documentation-outline',
    'inline-code',
    'kbd',
    'page-header',
    'page-navigation',
    'prose',
    'section',
    'table',
  ].map((subpath) => ({
    subpath,
    path: '/documentation/',
    selector: `[data-example="${subpath}"]`,
  })),
  ...[
    'code-block',
    'code-diff',
    'file-preview',
    'file-tree',
    'install-command',
    'terminal-window',
  ].map((subpath) => ({
    subpath,
    path: '/technical-content/',
    selector: `[data-example="${subpath}"]`,
  })),
  { subpath: 'brand-logo', path: '/', selector: '[data-example="brand-logo"]' },
  { subpath: 'document-head', path: '/', selector: 'head meta[name="robots"]' },
  { subpath: 'navigation-progress', path: '/', selector: '[data-navigation-progress]' },
  { subpath: 'search-dialog', path: '/', selector: '#gallery-search' },
  { subpath: 'site-footer', path: '/', selector: 'footer' },
  { subpath: 'site-header', path: '/', selector: 'header' },
  { subpath: 'skip-link', path: '/', selector: 'a[href="#main-content"]' },
  { subpath: 'theme-control', path: '/', selector: '[data-theme-control]' },
  { subpath: 'theme-init-script', path: '/', selector: 'html[data-resolved-theme]' },
];
