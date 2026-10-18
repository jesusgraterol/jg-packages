// a package as its Markdown version and the home page's list describe it
export type IMarkdownPackage = {
  description: string;
  name: string;
  // the runtimes' labels, such as Universal
  runtimes: readonly string[];
  version: string;
};

// the links a package's Markdown header gives
export type IPackageLinks = {
  npmUrl: string;
  recipesUrl: string;
  sourceUrl: string;
};

// a section of the home page: its eyebrow, title, and lede
export type IHomeSection = { eyebrow: string; lede: string; title: string };

// everything the home page's Markdown version holds
export type IHomeMarkdownOptions = {
  agentResources: readonly { href?: string | undefined; path: string; text: string }[];
  benefits: readonly { text: string; title: string }[];
  // the packages, grouped by their first runtime, as the page shows them
  groups: readonly {
    heading: string;
    packages: readonly IMarkdownPackage[];
    summary: string;
  }[];
  hero: { lede: string };
  sections: Record<'agents' | 'packages' | 'setup' | 'why', IHomeSection>;
  setup: {
    installCommand: string;
    policyUrl: string;
    skillUrl: string;
    steps: Record<'policy' | 'skill', { text: string; title: string }>;
  };
  site: { description: string; name: string; url: string };
};
