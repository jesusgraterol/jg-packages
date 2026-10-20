# jg-site recipes

Patterns for the parts of a website that search engines, coding agents, and returning visitors read: structured data, an llms.txt, and a remembered theme.

## Structured data from one site config

Use this in a site's shared layout, so every page describes itself the same way. The site's details live in one object, each page passes its own title, description, and breadcrumb, and the layout writes the result into the page's head:

```ts
import {
  buildStructuredData,
  type IStructuredDataSite,
  SEARCH_TEXT_LIMITS,
  serializeStructuredData,
} from 'jg-site';

// what one page passes to the layout
declare const page: {
  breadcrumbs: { name: string; path: string }[];
  description: string;
  path: string;
  title: string;
};

const SITE: IStructuredDataSite = {
  author: { name: 'Ada Lovelace', url: 'https://ada.example.com/' },
  language: 'en',
  name: 'Example Docs',
  url: 'https://docs.example.com',
};

// a build fails here instead of shipping a description search results cut short
if (page.description.length > SEARCH_TEXT_LIMITS.descriptionMaxLength) {
  throw new Error(`The description of ${page.path} is too long for search results.`);
}

const isHomePage = page.path === '/';
const structuredData = buildStructuredData({
  breadcrumbs: page.breadcrumbs,
  canonicalUrl: new URL(page.path, SITE.url).toString(),
  description: page.description,
  site: SITE,
  title: page.title,
  type: isHomePage ? 'website' : 'webpage',
});

// the markup the layout writes into <head>
const scriptElement = `<script type="application/ld+json">${serializeStructuredData(structuredData)}</script>`;
```

The breadcrumb is left out unless it has at least two steps, so the home page and pages directly under it don't get a one-step list.

## An llms.txt from the site's pages

Use this to give coding agents a map of the site. The build lists each page with its Markdown version, so an agent can read the text without the navigation and styles:

```ts
import { buildLlmsText, type ILlmsTextLink } from 'jg-site';

// the site's guides, as the content collection or file listing returns them
declare const guides: { title: string; slug: string; summary?: string }[];

const links: ILlmsTextLink[] = guides.map(({ slug, summary, title }) => ({
  description: summary,
  title,
  url: `https://docs.example.com/guides/${slug}.md`,
}));

const llmsText = buildLlmsText({
  name: 'Example Docs',
  summary: 'Guides and the API reference for the Example CLI.',
  details: ['Every page has a Markdown version at the same path, ending in .md.'],
  sections: [
    { heading: 'Install', body: 'Install the CLI with `npm install example-cli`.' },
    { heading: 'Guides', links },
  ],
});
```

A guide without a summary is listed by its title alone, and a title with brackets is escaped, so it stays one link.

## A theme switch that remembers the choice

Use this for a control that switches between the system's theme, light, and dark. The page applies the theme as soon as it loads, follows the system while the visitor hasn't chosen, and keeps working when the browser blocks storage:

```ts
import {
  type IThemePreference,
  readThemePreference,
  resolveThemePreference,
  THEME_PREFERENCES,
  writeThemePreference,
} from 'jg-site';

// a select element whose options are the preferences
declare const themeSelect: HTMLSelectElement;

const STORAGE_KEY = 'example-theme';
const darkScheme = matchMedia('(prefers-color-scheme: dark)');

const applyTheme = (preference: IThemePreference): void => {
  document.documentElement.dataset['theme'] = resolveThemePreference(
    preference,
    darkScheme.matches,
  );
};

let preference = readThemePreference(STORAGE_KEY);
applyTheme(preference);
themeSelect.replaceChildren(...THEME_PREFERENCES.map((value) => new Option(value, value)));
themeSelect.value = preference;

themeSelect.addEventListener('change', () => {
  preference = themeSelect.value as IThemePreference;
  // the theme still changes for this visit when the browser refuses to store it
  writeThemePreference(STORAGE_KEY, preference);
  applyTheme(preference);
});

// a visitor who follows the system sees its changes right away
darkScheme.addEventListener('change', () => applyTheme(preference));
```

To avoid a flash of the wrong theme, run the first `applyTheme` in an inline script in `<head>`, before the page paints.
