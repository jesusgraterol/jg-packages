import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import {
  Article,
  ArticleHeader,
  Blockquote,
  Heading,
  KeyboardKey,
  LargeText,
  Lead,
  ListItem,
  MutedText,
  OrderedList,
  Paragraph,
  Section,
  SmallText,
  Table,
  TableCell,
  TableContainer,
  TableHeaderCell,
  TableRow,
  UnorderedList,
  headingVariants,
} from './index.js';

test.each([1, 2, 3, 4, 5] as const)(
  'Heading(%d) preserves its semantic level independently of visual roles',
  (level) => {
    expect(renderToStaticMarkup(<Heading level={level}>Section title</Heading>)).toContain(
      `<h${level} `,
    );
  },
);

test.each(['display', 'public-page', 'section', 'product-page', 'product-statement'] as const)(
  'Heading(%s) applies the visual role without emitting it as an ARIA role',
  (role) => {
    const html = renderToStaticMarkup(
      <Heading
        level={2}
        role={role}
      >
        Product statement
      </Heading>,
    );
    expect(html).toContain(headingVariants({ role }));
    expect(html).toContain('<h2 ');
    expect(html).not.toContain('role=');
  },
);

test('plain typography keeps native roles, content, table semantics and attributes', () => {
  const html = renderToStaticMarkup(
    <Article aria-label="Project guide">
      <ArticleHeader>
        <Heading level={1}>Project guide</Heading>
        <Lead>Introduction</Lead>
      </ArticleHeader>
      <Section aria-label="Usage">
        <Heading
          level={2}
          role="presentation"
        >
          Usage
        </Heading>
        <Paragraph>
          Press <KeyboardKey>Enter</KeyboardKey>.
        </Paragraph>
        <LargeText>Summary</LargeText>
        <SmallText>Details</SmallText>
        <MutedText>Supporting information</MutedText>
        <Blockquote cite="https://example.com">Quoted text</Blockquote>
        <UnorderedList>
          <ListItem>First point</ListItem>
        </UnorderedList>
        <OrderedList start={2}>
          <ListItem>Second step</ListItem>
        </OrderedList>
        <TableContainer
          role="region"
          aria-label="Project settings"
          tabIndex={0}
        >
          <Table>
            <caption>Settings</caption>
            <thead>
              <TableRow>
                <TableHeaderCell scope="col">Name</TableHeaderCell>
              </TableRow>
            </thead>
            <tbody>
              <TableRow>
                <TableCell>Workspace</TableCell>
              </TableRow>
            </tbody>
          </Table>
        </TableContainer>
      </Section>
    </Article>,
  );
  expect(html).toContain('role="presentation"');
  expect(html).toContain('<kbd ');
  expect(html).toContain('<caption>Settings</caption>');
  expect(html).toContain('scope="col"');
  expect(html).toContain('start="2"');
  expect(html).toContain('cite="https://example.com"');
  expect(html).toContain('aria-label="Project settings" tabindex="0"');
  expect(html).toContain('Workspace</td>');
});
