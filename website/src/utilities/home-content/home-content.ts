/*
 * The home page's words, which the page and its Markdown version both read, so the two never
 * drift apart. Inline code is written as Markdown backticks; `splitInlineCode` turns it into
 * segments for the page.
 */

// the hero's eyebrow, its two-line title, and its lede
export const HOME_HERO = {
  eyebrow: 'TypeScript packages for coding agents',
  titleStart: 'Give your coding agent',
  titleEnd: 'tested code to build on.',
  lede: 'Errors, HTTP requests, storage, files, processes, and more, as small packages that share one set of conventions. Each ships its full API reference, so your agent writes less code and you review less of it.',
} as const;

// the eyebrow, title, and lede of each section, by its id
export const HOME_SECTIONS = {
  packages: {
    eyebrow: 'The packages',
    title: 'One job each, one set of conventions.',
    lede: 'Each one does one job, with the same error handling, naming, and docs as the others. Pick the ones you need; siblings depend on each other only where it saves you code.',
  },
  why: {
    eyebrow: 'Why agents use them',
    title: "Code your agent doesn't have to write.",
    lede: "Agents write code faster than anyone can review it. Each package replaces code an agent would otherwise generate with code that's already tested, documented, and consistent with the rest.",
  },
  setup: {
    eyebrow: 'Set up your agent',
    title: 'Two steps to put your agent on them.',
    lede: 'The policy tells your agent to prefer these packages, and the skill tells it which one fits each task. Both live in jg-skills, so they stay current as the packages change.',
  },
  agents: {
    eyebrow: 'Docs for agents',
    title: 'Docs your coding agent can read.',
    lede: 'The same READMEs and API references you read here, as Markdown: inside each package, and on this site.',
  },
} as const;

// what a coding agent gains from the packages, which also says how they're built
export const HOME_BENEFITS = [
  {
    id: 'less-code',
    title: 'Less code to generate and review',
    text: 'Your agent imports a tested function instead of writing a new one, so there’s less code to generate, review, and maintain.',
  },
  {
    id: 'one-error-model',
    title: 'One error model, server to client',
    text: 'Every failure is an Exception with a stable code and JSON data. APIs send it in one envelope and jg-fetch reads it back, so code checks codes, not messages.',
  },
  {
    id: 'docs-inside',
    title: 'Docs inside each package',
    text: 'Every package ships its full API reference as API.md, and every export has TSDoc, so an agent reads the docs of the installed version from node_modules.',
  },
  {
    id: 'checked-examples',
    title: 'Examples that are checked',
    text: 'Every example in the docs typechecks against the published package, and the ones without I/O run on every release, with their stated results asserted.',
  },
  {
    id: 'tested-as-installed',
    title: 'Tested as you install them',
    text: 'Each release is packed and installed into a new project before it ships, and browser code is tested in Chromium, Firefox, and WebKit.',
  },
  {
    id: 'one-set-of-conventions',
    title: 'One set of conventions',
    text: 'The same names, units in option names, ESM with types, and nothing running at import. An agent that knows one package knows how the others work.',
  },
] as const;

// the two steps of the agent setup; the policy, the skill, and the command are in SITE_CONFIG
export const AGENT_SETUP_STEPS = {
  policy: {
    title: 'Add the policy to your AGENTS.md',
    text: "A short `## jg-packages` section that tells your agent to prefer these packages and to check the installed version's `API.md` before using an export. jg-skills keeps it current.",
  },
  skill: {
    title: 'Install the skill',
    text: 'It tells your agent which package fits a task, even before the package is installed.',
  },
} as const;

// what agents can read, each linked once the site serves it
export const AGENT_RESOURCES: readonly { path: string; href?: string; text: string }[] = [
  {
    path: 'node_modules/<package>/API.md',
    text: 'The full API reference of the installed version, shipped in every package, so it reads offline.',
  },
  {
    path: 'node_modules/<package>/RECIPES.md',
    text: 'App-side patterns for the package, such as an API exception or a typed client, typechecked on every release.',
  },
  {
    path: '/llms.txt',
    href: '/llms.txt',
    text: 'An index of the packages in the llmstxt.org format, with a link to each package’s Markdown.',
  },
  {
    path: '/llms-full.txt',
    href: '/llms-full.txt',
    text: 'Every package’s README, API reference, and recipes in one file, for loading into a context window.',
  },
  {
    path: '/packages/<name>/index.md',
    text: 'The Markdown version of each page: a package’s README and its full API reference.',
  },
  {
    path: 'Accept: text/markdown',
    text: 'Request any page with this header to get its Markdown instead of HTML.',
  },
];

// a run of text, and whether it's inline code
export type IInlineSegment = { isCode: boolean; text: string };

/**
 * Splits text with Markdown inline code into runs, so a page can render the code spans.
 * @param text The text, with code in single backticks.
 * @returns The runs, in order, without empty ones.
 */
export const splitInlineCode = (text: string): IInlineSegment[] =>
  text
    .split('`')
    .map((part, index) => ({ isCode: index % 2 === 1, text: part }))
    .filter(({ text: part }) => part !== '');
