import { isValidElement } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';
import { z } from 'zod';

import {
  MARKDOWN_VARIABLE_DATA_SLOT,
  MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES,
  getMarkdownVariableMatches,
} from '../../shared/markdown-variables/index.js';
import {
  parseYouTubeVideoUrl,
  type IYouTubeVideoDescriptor,
} from '../../shared/youtube-video/index.js';

// stable non-routable base keeps relative-link classification identical during server and browser rendering.
const MARKDOWN_LINK_RESOLUTION_BASE_URL = 'https://markdown.invalid/';

// required relation tokens isolate new tabs and suppress referrer disclosure.
const SECURE_MARKDOWN_LINK_REL_TOKENS = ['noopener', 'noreferrer'] as const;

// image title hints describe a positive, safely representable display width in CSS pixels.
const MarkdownImageWidthSchema = z.int().positive();

// code-like nodes keep authored template placeholders literal instead of highlighting them.
const MARKDOWN_VARIABLE_IGNORED_TAG_NAMES = new Set(['code', 'pre', 'script', 'style']);

// minimal HAST shapes used by the variable highlighter without coupling app-ui to rehype types.
type IMarkdownHastNode = {
  type: string;
  tagName?: unknown;
  value?: unknown;
  properties?: Record<string, unknown>;
  children?: IMarkdownHastNode[];
};

type IMarkdownHastParentNode = IMarkdownHastNode & {
  children: IMarkdownHastNode[];
};

type IMarkdownHastElementNode = IMarkdownHastNode & {
  type: 'element';
  tagName: string;
};

type IMarkdownHastTextNode = IMarkdownHastNode & {
  type: 'text';
  value: string;
};

/**
 * Returns true when a value is a non-null object record.
 * @param value The value to inspect.
 * @returns True when the value can be read as a record.
 */
const isMarkdownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Returns true when a value has the minimum shape of a HAST node.
 * @param value The value to inspect.
 * @returns True when the value can be traversed as a markdown HAST node.
 */
const isMarkdownHastNode = (value: unknown): value is IMarkdownHastNode =>
  isMarkdownRecord(value) && typeof value['type'] === 'string';

/**
 * Returns true when a HAST node is a text node with string content.
 * @param node The HAST node to inspect.
 * @returns True when the node can be split into text and variable highlight nodes.
 */
const isMarkdownHastTextNode = (node: IMarkdownHastNode): node is IMarkdownHastTextNode =>
  node.type === 'text' && typeof node.value === 'string';

/**
 * Returns true when a HAST node is an element with a string tag name.
 * @param node The HAST node to inspect.
 * @returns True when the node can be checked against ignored tag names.
 */
const isMarkdownHastElementNode = (node: IMarkdownHastNode): node is IMarkdownHastElementNode =>
  node.type === 'element' && typeof node.tagName === 'string';

/**
 * Returns true when a HAST node owns mutable children.
 * @param node The HAST node to inspect.
 * @returns True when the node's children can be traversed and replaced.
 */
const hasMarkdownHastChildren = (node: IMarkdownHastNode): node is IMarkdownHastParentNode =>
  Array.isArray(node.children);

/**
 * Creates the highlighted HAST node used for a template variable token.
 * @param variableToken The matched variable token including its curly braces.
 * @returns A mark element that preserves the original token text.
 */
const createMarkdownVariableHighlightNode = (variableToken: string): IMarkdownHastElementNode => ({
  type: 'element',
  tagName: 'mark',
  properties: {
    className: [...MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES],
    'data-slot': MARKDOWN_VARIABLE_DATA_SLOT,
  },
  children: [
    {
      type: 'text',
      value: variableToken,
    },
  ],
});

/**
 * Splits a text node around variable tokens and wraps each token in a highlight node.
 * @param node The text node to split.
 * @returns The original node when no variables exist, or replacement text and mark nodes.
 */
const splitMarkdownTextNodeByVariables = (
  node: IMarkdownHastTextNode,
): readonly IMarkdownHastNode[] => {
  const highlightedNodes: IMarkdownHastNode[] = [];
  let currentIndex = 0;

  for (const match of getMarkdownVariableMatches(node.value)) {
    const variableToken = match.token;
    const variableIndex = match.index;

    if (variableIndex > currentIndex) {
      highlightedNodes.push({
        type: 'text',
        value: node.value.slice(currentIndex, variableIndex),
      });
    }

    highlightedNodes.push(createMarkdownVariableHighlightNode(variableToken));
    currentIndex = variableIndex + variableToken.length;
  }

  if (highlightedNodes.length === 0) {
    return [node];
  }

  if (currentIndex < node.value.length) {
    highlightedNodes.push({
      type: 'text',
      value: node.value.slice(currentIndex),
    });
  }

  return highlightedNodes;
};

/**
 * Highlights variables inside a parent node's direct children and descendants.
 * @param parentNode The parent HAST node whose children should be normalized.
 */
const highlightMarkdownVariablesInChildren = (parentNode: IMarkdownHastParentNode): void => {
  const nextChildren: IMarkdownHastNode[] = [];

  for (const childNode of parentNode.children) {
    if (isMarkdownHastTextNode(childNode)) {
      for (const highlightedNode of splitMarkdownTextNodeByVariables(childNode)) {
        nextChildren.push(highlightedNode);
      }
      continue;
    }

    highlightMarkdownVariablesInNode(childNode);
    nextChildren.push(childNode);
  }

  parentNode.children = nextChildren;
};

/**
 * Highlights variables throughout a HAST node unless the node owns code-like content.
 * @param node The HAST node to inspect.
 */
const highlightMarkdownVariablesInNode = (node: IMarkdownHastNode): void => {
  if (
    isMarkdownHastElementNode(node) &&
    MARKDOWN_VARIABLE_IGNORED_TAG_NAMES.has(node.tagName.toLowerCase())
  ) {
    return;
  }

  if (hasMarkdownHastChildren(node)) {
    highlightMarkdownVariablesInChildren(node);
  }
};

/**
 * Highlights template variables in a React Markdown HAST tree.
 * @param tree The HAST tree emitted by React Markdown.
 */
const highlightMarkdownVariablesTree = (tree: unknown): void => {
  if (isMarkdownHastNode(tree)) {
    highlightMarkdownVariablesInNode(tree);
  }
};

/**
 * Creates the rehype plugin that highlights moldea template variables.
 * @returns A HAST transformer compatible with React Markdown's rehype plugin pipeline.
 */
export const highlightMarkdownVariablesRehypePlugin = (): typeof highlightMarkdownVariablesTree =>
  highlightMarkdownVariablesTree;

/**
 * Extracts plain text from React-rendered markdown node content.
 * @param node The node content emitted by React Markdown.
 * @returns The concatenated text content.
 */
export const extractMarkdownText = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map(extractMarkdownText).join('');
  }

  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractMarkdownText(node.props.children);
  }

  return '';
};

/**
 * Removes React Markdown's internal node prop before forwarding element props.
 * @param props The props emitted by React Markdown.
 * @returns The same props without the internal node field.
 */
export const omitMarkdownNode = <T extends { node?: unknown }>(props: T): Omit<T, 'node'> => {
  const { node, ...rest } = props;

  void node;

  return rest;
};

/**
 * Reads a reserved width=<pixels> image title without interpreting ordinary title text.
 * @param title The optional title emitted by the Markdown image parser.
 * @returns A positive integer display width, or undefined for ordinary or invalid titles.
 * @example
 * import { getMarkdownImageDisplayWidth } from 'jg-react-ui/components/markdown';
 * getMarkdownImageDisplayWidth('width=560'); // => 560
 */
export const getMarkdownImageDisplayWidth = (title: string | undefined): number | undefined => {
  const match = /^width=(\d+)$/.exec(title ?? '');
  if (!match) return undefined;

  const width = MarkdownImageWidthSchema.safeParse(Number(match[1]));
  return width.success ? width.data : undefined;
};

/**
 * Checks whether a Markdown destination represents HTTP(S) document navigation.
 * @param href The final link destination emitted by React Markdown.
 * @returns True for absolute and relative web navigation except fragment-only links.
 */
export const isMarkdownWebNavigationHref = (href: string | undefined): boolean => {
  const normalizedHref = href?.trim();

  if (!normalizedHref || normalizedHref.startsWith('#')) {
    return false;
  }

  try {
    const resolvedUrl = new URL(normalizedHref, MARKDOWN_LINK_RESOLUTION_BASE_URL);

    return resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Adds the required security tokens to an existing Markdown link relation.
 * @param rel The relation tokens already assigned to the link.
 * @returns The preserved relation with noopener and noreferrer present exactly once.
 */
export const mergeSecureMarkdownLinkRel = (rel: string | undefined): string => {
  const relationTokens = rel?.split(/\s+/).filter(Boolean) ?? [];

  for (const requiredRelationToken of SECURE_MARKDOWN_LINK_REL_TOKENS) {
    if (
      !relationTokens.some((relationToken) => relationToken.toLowerCase() === requiredRelationToken)
    ) {
      relationTokens.push(requiredRelationToken);
    }
  }

  return relationTokens.join(' ');
};

/**
 * Resolves a standalone plain-text YouTube link paragraph into a video descriptor.
 * @param node The React Markdown HAST paragraph candidate.
 * @returns The validated video descriptor, or null when the paragraph should render normally.
 */
export const getMarkdownYouTubeVideoDescriptor = (
  node: unknown,
): IYouTubeVideoDescriptor | null => {
  if (
    !isMarkdownHastNode(node) ||
    !isMarkdownHastElementNode(node) ||
    node.tagName !== 'p' ||
    !hasMarkdownHastChildren(node) ||
    node.children.length !== 1
  ) {
    return null;
  }

  const linkNode = node.children[0];

  if (
    !linkNode ||
    !isMarkdownHastElementNode(linkNode) ||
    linkNode.tagName !== 'a' ||
    !hasMarkdownHastChildren(linkNode) ||
    linkNode.children.length !== 1 ||
    typeof linkNode.properties?.['href'] !== 'string'
  ) {
    return null;
  }

  const labelNode = linkNode.children[0];

  if (!labelNode || !isMarkdownHastTextNode(labelNode)) {
    return null;
  }

  return parseYouTubeVideoUrl(linkNode.properties['href'], labelNode.value);
};

/**
 * Resolves consistent heading spacing for markdown headings.
 * @param className Optional class names from the markdown renderer.
 * @param options Heading-specific formatting options.
 * @returns A class name string for the markdown heading.
 */
export const getMarkdownHeadingClassName = (
  className?: string,
  options?: { isLevelOne?: boolean },
): string => cn('mt-8 first:mt-0', options?.isLevelOne ? 'text-left' : undefined, className);
