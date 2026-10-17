import {
  formatSignature,
  groupSymbols,
  parseExample,
  splitThrowsItem,
  toEntryPointAnchor,
  toImportSpecifier,
  toSymbolAnchor,
} from './presentation.ts';
import type { IApiMember, IApiReference, IApiSignature, IApiSymbol } from './types.ts';

// what renderApiMarkdown accepts
export type IRenderApiMarkdownOptions = {
  // the level of the reference's title: 1 for a document of its own, such as API.md, or 2 under a
  // README. Every other heading follows from it. Defaults to 1
  headingLevel?: 1 | 2;
};

// how each kind is named under its symbol's heading
const KIND_LABELS: Record<IApiSymbol['kind'], string> = {
  class: 'Class',
  constant: 'Constant',
  enum: 'Enum',
  function: 'Function',
  interface: 'Interface',
  type: 'Type',
  variable: 'Variable',
};

/**
 * Turns TSDoc text into Markdown paragraphs: line breaks within a paragraph become spaces, and
 * blank lines keep separating paragraphs.
 * @param text The TSDoc text.
 * @returns The paragraphs.
 */
const toParagraphs = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replaceAll(/\s*\n\s*/g, ' '))
    .filter((paragraph) => paragraph !== '')
    .join('\n\n');

/**
 * Builds a heading with an anchor the website's HTML page also uses.
 * @param level The heading level.
 * @param anchor The anchor.
 * @param text The heading's text.
 * @returns The heading line.
 */
const heading = (level: number, anchor: string, text: string): string =>
  `${'#'.repeat(level)} <a id="${anchor}"></a>${text}`;

/**
 * Wraps code in a fenced block, with a fence longer than any backtick run inside it.
 * @param code The code.
 * @param lang The language.
 * @returns The block.
 */
const fence = (code: string, lang = 'ts'): string => {
  const longestRun = Math.max(2, ...[...code.matchAll(/`+/g)].map(([run]) => run.length));
  const marker = '`'.repeat(longestRun + 1);
  return `${marker}${lang}\n${code}\n${marker}`;
};

/**
 * Wraps text in inline code, with backticks that the text can't close early.
 * @param text The text.
 * @returns The inline code.
 */
const code = (text: string): string => (text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``);

/**
 * Renders one signature: its own summary when it differs from the symbol's, the formatted
 * signature, and its parameters, return value, and errors.
 * @param signature The signature.
 * @param symbolSummary The symbol's summary.
 * @returns The Markdown blocks.
 */
const renderSignature = (signature: IApiSignature, symbolSummary: string): string[] => {
  const blocks: string[] = [];
  if (signature.summary.trim() !== '' && signature.summary !== symbolSummary) {
    blocks.push(toParagraphs(signature.summary));
  }
  blocks.push(fence(formatSignature(signature.text)));
  if (signature.parameters.length > 0) {
    blocks.push(
      [
        '**Parameters**',
        '',
        ...signature.parameters.map((parameter) => {
          const name = `${parameter.isRest ? '...' : ''}${parameter.name}${parameter.isOptional ? '?' : ''}`;
          const defaults =
            parameter.defaultValue === undefined
              ? ''
              : ` Defaults to ${code(parameter.defaultValue)}.`;
          return `- ${code(name)} ${code(parameter.type)}: ${toParagraphs(parameter.description || 'No description.')}${defaults}`;
        }),
      ].join('\n'),
    );
  }
  if (signature.returnType !== 'void' && signature.returnType !== '') {
    blocks.push(
      `**Returns** ${code(signature.returnType)}: ${toParagraphs(signature.returns || 'No description.')}`,
    );
  }
  if (signature.throws.length > 0) {
    blocks.push(
      [
        '**Throws**',
        '',
        ...signature.throws.map((item) => {
          const { code: errorCode, message } = splitThrowsItem(item);
          return errorCode === undefined
            ? `- ${toParagraphs(message)}`
            : `- ${code(errorCode)}: ${toParagraphs(message)}`;
        }),
      ].join('\n'),
    );
  }
  return blocks;
};

/**
 * Renders a member of a class or an object type as a list item.
 * @param member The member.
 * @returns The list item.
 */
const renderMember = (member: IApiMember): string => {
  const declarations =
    member.signatures.length > 0
      ? member.signatures.map(({ text }) => code(text))
      : member.type === undefined
        ? [code(member.name)]
        : [code(`${member.name}: ${member.type}`)];
  const summary = member.summary.trim() === '' ? '' : `: ${toParagraphs(member.summary)}`;
  return `- ${declarations.join(', ')} (${member.kind})${summary}`;
};

/**
 * Renders one symbol: its heading, kind, summary, deprecation, signatures, declaration, members,
 * and examples.
 * @param symbol The symbol.
 * @param anchor The symbol's anchor.
 * @param level The symbol heading's level.
 * @returns The Markdown.
 */
const renderSymbol = (symbol: IApiSymbol, anchor: string, level: number): string => {
  const blocks = [
    heading(level, anchor, code(symbol.name)),
    `*${KIND_LABELS[symbol.kind]}${symbol.deprecated === undefined ? '' : ', deprecated'}*`,
  ];
  if (symbol.summary.trim() !== '') {
    blocks.push(toParagraphs(symbol.summary));
  }
  if (symbol.deprecated !== undefined) {
    blocks.push(`> **Deprecated.** ${toParagraphs(symbol.deprecated)}`);
  }
  for (const signature of symbol.signatures) {
    blocks.push(...renderSignature(signature, symbol.summary));
  }
  if (symbol.type !== undefined) {
    blocks.push(
      fence(
        symbol.kind === 'constant' || symbol.kind === 'variable'
          ? `const ${symbol.name}: ${symbol.type}`
          : symbol.type,
      ),
    );
  }
  if (symbol.members.length > 0) {
    blocks.push(['**Members**', '', ...symbol.members.map(renderMember)].join('\n'));
  }
  // the symbol's own examples, or its signatures' when it has none, without repeats
  const examples = [
    ...new Set(
      symbol.examples.length > 0
        ? symbol.examples
        : symbol.signatures.flatMap((signature) => signature.examples),
    ),
  ].map(parseExample);
  examples.forEach(({ code: example, lang }, index) => {
    blocks.push(
      `**${examples.length > 1 ? `Example ${index + 1}` : 'Example'}**`,
      fence(example, lang),
    );
  });
  return blocks.join('\n\n');
};

/**
 * Renders a package's API reference as Markdown: every entry point, its exports grouped by kind,
 * and each export with its signatures, parameters, return value, errors, and examples. Each heading
 * carries the anchor of the same heading on the package's website page. It's the one Markdown
 * renderer: packages ship its output as API.md, and the website serves it under each README.
 * @param reference The package's API reference.
 * @param options The title's heading level.
 * @returns The Markdown, ending with a newline.
 * @example
 * const markdown = renderApiMarkdown(await extractApiReference('packages/jg-fs'));
 * // '# jg-fs API reference\n\n...'
 */
export const renderApiMarkdown = (
  reference: IApiReference,
  { headingLevel = 1 }: IRenderApiMarkdownOptions = {},
): string => {
  const hasSeveralEntryPoints = reference.entryPoints.length > 1;
  const symbolCount = reference.entryPoints.reduce(
    (count, { symbols }) => count + symbols.length,
    0,
  );
  const sections = [
    heading(headingLevel, 'api-reference', `${reference.packageName} API reference`),
    `Every export of ${code(`${reference.packageName}@${reference.version}`)}, ${symbolCount} in all, with its signature, its errors, and an example. It's generated from the package's TSDoc.`,
  ];
  for (const entryPoint of reference.entryPoints) {
    const specifier = toImportSpecifier(reference.packageName, entryPoint.subpath);
    const groupLevel = headingLevel + (hasSeveralEntryPoints ? 2 : 1);
    const groups = groupSymbols(entryPoint);
    if (hasSeveralEntryPoints) {
      sections.push(
        heading(headingLevel + 1, toEntryPointAnchor(entryPoint.subpath), code(specifier)),
      );
    }
    sections.push(
      groups
        .map(
          ({ heading: groupHeading, symbols }) =>
            `- ${groupHeading}: ${symbols
              .map(({ name }) => `[${code(name)}](#${toSymbolAnchor(entryPoint.subpath, name)})`)
              .join(', ')}`,
        )
        .join('\n'),
    );
    for (const { heading: groupHeading, id, symbols } of groups) {
      sections.push(
        heading(
          groupLevel,
          id,
          hasSeveralEntryPoints ? `${groupHeading} in ${code(specifier)}` : groupHeading,
        ),
      );
      for (const symbol of symbols) {
        sections.push(
          renderSymbol(symbol, toSymbolAnchor(entryPoint.subpath, symbol.name), groupLevel + 1),
        );
      }
    }
  }
  return `${sections.join('\n\n')}\n`;
};
