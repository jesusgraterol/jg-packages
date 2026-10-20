// the site every page's structured data belongs to
export type IStructuredDataSite = {
  author: { name: string; url: string };
  language: string;
  name: string;
  url: string;
};

// one page the home page lists, in display order
export type IListedPage = { name: string; path: string };

// the source code a page documents, such as a package in the repository
export type IStructuredDataSourceCode = {
  // where the code lives, such as the package's directory on GitHub
  codeRepository: string;
  // the license's URL
  license: string;
  name: string;
  programmingLanguage: string;
  version: string;
};

// the values one page's JSON-LD describes
export type IStructuredDataOptions = {
  // the hierarchy the page's breadcrumb shows, from the home page to this page, as site-relative
  // paths
  breadcrumbs?: readonly { name: string; path: string }[] | undefined;
  canonicalUrl: string;
  description: string;
  listedPages?: readonly IListedPage[] | undefined;
  site: IStructuredDataSite;
  sourceCode?: IStructuredDataSourceCode | undefined;
  title: string;
  // the home page is the website; every other page is a web page within it
  type: 'website' | 'webpage';
};
