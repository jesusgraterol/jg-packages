import type * as React from 'react';
import { cn } from 'cnfast';
import { createElement, type SyntaxHighlighterProps } from 'react-syntax-highlighter';

import { CodeBlockSyntaxHighlighter } from './code-highlighting.js';

// renderer contracts supplied by the registered syntax highlighter.
type IDiffRenderer = NonNullable<SyntaxHighlighterProps['renderer']>;
type IDiffNode = Parameters<IDiffRenderer>[0]['rows'][number];

// patch rows retain their original endings independently from highlighted source excerpts.
interface IDiffLine {
  index: number;
  marker: string;
  content: string;
  lineEnding: string;
  isAdded: boolean;
  isRemoved: boolean;
}

// omitted unified hunk counts mean one line; trailing function context is optional.
const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@(?: .*)?$/;

// nested highlighters supply token rows without introducing preformatted containers or spacing.
const SOURCE_STYLE: React.CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  display: 'block',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  lineHeight: 'inherit',
  margin: 0,
  padding: 0,
  whiteSpace: 'inherit',
};
const SOURCE_CODE_PROPS = { style: SOURCE_STYLE };

/** Extracts a syntax row's original text, including indentation and line endings. */
const extractDiffText = (node: IDiffNode): string =>
  node.type === 'text'
    ? String(node.value ?? '')
    : (node.children?.map(extractDiffText).join('') ?? '');

/** Separates patch markers and endings, using hunk counts to disambiguate header-like source. */
const parseDiffLines = (rows: IDiffNode[]): IDiffLine[] => {
  let beforeRemaining = 0;
  let afterRemaining = 0;

  return rows.flatMap((row, index) => {
    const source = extractDiffText(row);
    if (source === '') {
      return [];
    }

    const lineEnding = source.endsWith('\r\n') ? '\r\n' : source.endsWith('\n') ? '\n' : '';
    const lineText = source.slice(0, lineEnding ? -lineEnding.length : undefined);
    const hunkHeader = HUNK_HEADER.exec(lineText);
    if (hunkHeader) {
      beforeRemaining = Number(hunkHeader[1] ?? '1');
      afterRemaining = Number(hunkHeader[2] ?? '1');
    }

    const isHunkSource =
      (beforeRemaining > 0 || afterRemaining > 0) &&
      (source[0] === '-' || source[0] === '+' || source[0] === ' ');
    const prefix = row.children?.find((node) => node.properties?.className.includes('prefix'));
    const marker = isHunkSource || prefix ? (source[0] ?? '') : '';
    const isAdded = marker === '+';
    const isRemoved = marker === '-';
    const content = lineText.slice(marker ? 1 : 0);

    if (isHunkSource) {
      if (!isAdded) beforeRemaining = Math.max(0, beforeRemaining - 1);
      if (!isRemoved) afterRemaining = Math.max(0, afterRemaining - 1);
    }

    return [{ index, marker, content, lineEnding, isAdded, isRemoved }];
  });
};

/** Removes the highlighter's row ending; the patch row owns the visible selection break. */
const trimSourceRowEnding = (node: IDiffNode): IDiffNode => {
  if (node.type === 'text') {
    return { ...node, value: String(node.value ?? '').replace(/\r?\n$/, '') };
  }

  return {
    ...node,
    ...(node.children
      ? {
          children: node.children.map((child, index, children) =>
            index === children.length - 1 ? trimSourceRowEnding(child) : child,
          ),
        }
      : {}),
  };
};

/** Renders one patch line with contiguous change backgrounds and compact edge insets. */
const renderDiffLine = (
  line: IDiffLine,
  content: React.ReactNode,
  firstIndex: number,
  lastIndex: number,
): React.ReactNode => (
  <span
    key={line.index}
    data-change={line.isAdded ? 'added' : line.isRemoved ? 'removed' : undefined}
    className={cn('block px-4', {
      'pt-1': line.index === firstIndex,
      'pb-1': line.index === lastIndex,
      'bg-chart-1/12': line.isAdded,
      'bg-destructive/8 dark:bg-destructive/12': line.isRemoved,
    })}
  >
    <span
      className={cn('inline-block w-6 align-top font-semibold', {
        'text-chart-1': line.isAdded,
      })}
    >
      {line.marker}
    </span>
    <span className="inline-block w-[calc(100%-1.5rem)] align-top [overflow-wrap:anywhere]">
      {content}
    </span>
    <span
      className="hidden"
      aria-hidden="true"
    >
      {line.lineEnding}
    </span>
  </span>
);

/**
 * Creates the patch renderer for an optional, explicitly authored source language.
 * Each contiguous excerpt highlights its before and after versions once, preserving multiline
 * syntax while resetting lexical context at file and hunk metadata.
 * @param sourceLanguage The registered source grammar, such as typescript or yaml.
 * @returns A renderer preserving patch text, neutral metadata, and source syntax colors.
 */
export const createDiffRenderer =
  (sourceLanguage?: string): IDiffRenderer =>
  ({ rows, stylesheet, useInlineStyles }): React.ReactNode => {
    const lines = parseDiffLines(rows);
    const firstIndex = lines[0]?.index ?? 0;
    const lastIndex = lines.at(-1)?.index ?? 0;
    const renderLine = (line: IDiffLine, content: React.ReactNode = line.content) =>
      renderDiffLine(line, content, firstIndex, lastIndex);

    if (!sourceLanguage) {
      return lines.map((line) => renderLine(line));
    }

    // a small foreground blend keeps syntax tokens readable over both change backgrounds.
    const sourceStylesheet = Object.fromEntries(
      Object.entries(stylesheet).map(([selector, tokenStyle]) => [
        selector,
        typeof tokenStyle.color === 'string'
          ? {
              ...tokenStyle,
              color: `color-mix(in srgb, ${tokenStyle.color} 80%, var(--foreground))`,
            }
          : tokenStyle,
      ]),
    );

    const sections: [IDiffLine, ...IDiffLine[]][] = [];
    for (const line of lines) {
      const previousSection = sections.at(-1);
      // end-of-file annotations do not interrupt the surrounding excerpt's syntax context.
      const isEndOfFileAnnotation = line.content === '\\ No newline at end of file';
      if ((line.marker || isEndOfFileAnnotation) && previousSection?.[0]?.marker) {
        previousSection.push(line);
      } else {
        sections.push([line]);
      }
    }

    return sections.map((section) => {
      const firstLine = section[0];
      if (!firstLine.marker) {
        return renderLine(firstLine);
      }

      const before = section
        .filter((line) => line.marker && !line.isAdded)
        .map((line) => line.content)
        .join('\n');
      const after = section
        .filter((line) => line.marker && !line.isRemoved)
        .map((line) => line.content)
        .join('\n');

      const renderSourceRows = (
        beforeRows: IDiffNode[],
        afterRows: IDiffNode[],
      ): React.ReactNode => {
        let beforeIndex = 0;
        let afterIndex = 0;
        return section.map((line) => {
          if (!line.marker) {
            return renderLine(line);
          }

          const sourceRow = line.isRemoved ? beforeRows[beforeIndex] : afterRows[afterIndex];
          if (!line.isAdded) beforeIndex += 1;
          if (!line.isRemoved) afterIndex += 1;
          const content = sourceRow
            ? createElement({
                node: trimSourceRowEnding(sourceRow),
                stylesheet: sourceStylesheet,
                useInlineStyles,
                key: `source-${line.index}`,
              })
            : line.content;
          return renderLine(line, content);
        });
      };

      const renderBefore: IDiffRenderer = ({ rows: beforeRows }) => {
        const renderAfter: IDiffRenderer = ({ rows: afterRows }) =>
          renderSourceRows(beforeRows, afterRows);
        return (
          <CodeBlockSyntaxHighlighter
            PreTag="span"
            CodeTag="span"
            customStyle={SOURCE_STYLE}
            codeTagProps={SOURCE_CODE_PROPS}
            language={sourceLanguage}
            style={sourceStylesheet}
            renderer={renderAfter}
          >
            {after}
          </CodeBlockSyntaxHighlighter>
        );
      };

      return (
        <CodeBlockSyntaxHighlighter
          key={firstLine.index}
          PreTag="span"
          CodeTag="span"
          customStyle={SOURCE_STYLE}
          codeTagProps={SOURCE_CODE_PROPS}
          language={sourceLanguage}
          style={sourceStylesheet}
          renderer={renderBefore}
        >
          {before}
        </CodeBlockSyntaxHighlighter>
      );
    });
  };
