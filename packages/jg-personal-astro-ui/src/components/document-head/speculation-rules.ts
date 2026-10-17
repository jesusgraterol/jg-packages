// links whose targets are never prerendered: Markdown, text, feeds and images, which aren't pages
const NOT_PRERENDERED = ['/*.md', '/*.txt', '/*.xml', '/*.png'] as const;

/*
 * The speculation rules every jg page carries. Browsers that support them prerender a same-site
 * page once the pointer rests on its link, so following the link shows the page at once. It's
 * JSON the browser reads, not a script that runs.
 */
export const SPECULATION_RULES = {
  prerender: [
    {
      where: {
        and: [
          { href_matches: '/*' },
          ...NOT_PRERENDERED.map((pattern) => ({ not: { href_matches: pattern } })),
        ],
      },
      eagerness: 'moderate',
    },
  ],
};
