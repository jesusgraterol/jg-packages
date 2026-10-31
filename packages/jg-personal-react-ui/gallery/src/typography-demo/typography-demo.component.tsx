import {
  Article,
  ArticleHeader,
  Blockquote,
  Heading,
  InlineCode,
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
  TextLink,
  UnorderedList,
} from 'jg-personal-react-ui';

/** Renders prose, long inline code and a labelled keyboard-scrollable table. */
export const TypographyDemo = () => (
  <section aria-labelledby="typography-title">
    <h2 id="typography-title">Typography and technical text</h2>
    <Article>
      <ArticleHeader>
        <Heading
          level={3}
          role="product-page"
        >
          A familiar workspace, in JG’s voice.
        </Heading>
        <Lead>Shared component behavior with Ubuntu Sans and the JG palette.</Lead>
      </ArticleHeader>
      <Section aria-label="Technical content">
        <Paragraph>
          Open{' '}
          <InlineCode>
            /workspace/projects/really-long-project-name/configuration/preferences.ts
          </InlineCode>
          , then press <KeyboardKey>Enter</KeyboardKey>.{' '}
          <TextLink href="#controls-title">Review the workspace controls</TextLink>.
        </Paragraph>
        <LargeText>Built for everyday work.</LargeText>
        <SmallText>Changes are saved per workspace.</SmallText>
        <MutedText>Supporting information stays readable in both themes.</MutedText>
        <Blockquote>
          Keep the implementation familiar and let the design system set the tone.
        </Blockquote>
        <UnorderedList>
          <ListItem>Accessible names and visible focus.</ListItem>
          <ListItem>Layouts that work with long content.</ListItem>
        </UnorderedList>
        <OrderedList>
          <ListItem>Choose a workspace.</ListItem>
          <ListItem>Review its settings.</ListItem>
        </OrderedList>
        <TableContainer
          role="region"
          aria-label="Package responsibilities"
          tabIndex={0}
          className="rounded outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          <Table className="min-w-[36rem]">
            <caption className="mb-3 text-left text-sm">One owner for each responsibility</caption>
            <thead>
              <TableRow>
                <TableHeaderCell scope="col">Package</TableHeaderCell>
                <TableHeaderCell scope="col">Responsibility</TableHeaderCell>
              </TableRow>
            </thead>
            <tbody>
              <TableRow>
                <TableCell>
                  <InlineCode>jg-personal-ui</InlineCode>
                </TableCell>
                <TableCell>Fonts, design tokens, and canonical artwork.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <InlineCode>jg-react-ui</InlineCode>
                </TableCell>
                <TableCell>Shared component behavior and public APIs.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <InlineCode>jg-personal-react-ui</InlineCode>
                </TableCell>
                <TableCell>JG styling and the same React implementations.</TableCell>
              </TableRow>
            </tbody>
          </Table>
        </TableContainer>
      </Section>
    </Article>
  </section>
);
