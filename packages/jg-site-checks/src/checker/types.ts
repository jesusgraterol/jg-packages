// the canonical URL and indexing policy expected for a single served page
export type IStaticSitePage = {
  path: string;
  canonicalUrl: string | null;
  indexable: boolean;
};

// discovery paths are same-origin site paths such as /sitemap-index.xml
export type IStaticSiteDiscovery = {
  sitemap?: string;
  robots?: string;
  llms?: string;
};

// traversal and cumulative UTF-8 file read limits for one artifact
export type IStaticSiteLimits = {
  entries: number;
  textBytes: number;
  totalTextBytes: number;
};

// caller-owned site expectations and the local artifact containing its built files
export type IVerifyStaticSiteOptions = {
  artifactRoot: string;
  origin: string;
  pages: IStaticSitePage[];
  discovery?: IStaticSiteDiscovery;
  limits?: Partial<IStaticSiteLimits>;
};

// the verified inventory page and the relative build file that serves it
export type ICheckedSitePage = IStaticSitePage & { file: string };

// the exact sitemap location and optional published modification date
export type ISiteSitemapEntry = {
  url: string;
  lastmod?: string;
};

// verified pages in input order and, when enabled, sitemap entries in document order
export type IStaticSiteVerification = {
  pages: ICheckedSitePage[];
  sitemapEntries?: ISiteSitemapEntry[];
};
