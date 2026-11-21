// the verification-relevant parts of one parsed HTML file
export type IHtmlScan = {
  anchors: Set<string>;
  canonicalLinks: string[];
  noindex: boolean;
  links: string[];
};
