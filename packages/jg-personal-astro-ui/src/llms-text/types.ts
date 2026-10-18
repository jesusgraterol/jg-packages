// one link of an llms.txt section, with what the reader finds there
export type ILlmsTextLink = { description: string; title: string; url: string };

// one `##` section of an llms.txt
export type ILlmsTextSection = { heading: string; links: readonly ILlmsTextLink[] };

// what an llms.txt says, in the llmstxt.org format
export type ILlmsTextOptions = {
  // paragraphs after the summary, before the sections
  details?: readonly string[] | undefined;
  name: string;
  sections: readonly ILlmsTextSection[];
  // one sentence on what the site is, the blockquote under the title
  summary: string;
};

// a site's documents gathered into one file for a context window
export type ILlmsFullTextOptions = {
  documents: readonly string[];
  name: string;
  summary: string;
};
