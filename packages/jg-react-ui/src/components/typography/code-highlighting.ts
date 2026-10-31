import { PrismLight } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css.js';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff.js';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker.js';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql.js';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini.js';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript.js';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json.js';
import json5 from 'react-syntax-highlighter/dist/esm/languages/prism/json5.js';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx.js';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup.js';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown.js';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python.js';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss.js';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql.js';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml.js';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx.js';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript.js';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml.js';

import {
  getSyntaxHighlightStyle,
  useResolvedSyntaxHighlightTheme,
  type IResolvedSyntaxHighlightTheme,
  type ISyntaxHighlightStyle,
} from '../../shared/syntax-highlighting/index.js';

// code block highlight themes follow the app theme while staying owned by typography.
type IResolvedCodeBlockTheme = IResolvedSyntaxHighlightTheme;

// code block Prism style maps carry token selector styles for static snippets.
type ICodeBlockHighlightStyle = ISyntaxHighlightStyle;

// code block syntax highlighter registers the grammars used by the CodeBlock primitive.
export const CodeBlockSyntaxHighlighter = PrismLight;

// code block syntax registration is owned by the typography CodeBlock primitive.
CodeBlockSyntaxHighlighter.registerLanguage('bash', bash);
CodeBlockSyntaxHighlighter.alias('bash', ['dotenv', 'env']);
CodeBlockSyntaxHighlighter.registerLanguage('css', css);
CodeBlockSyntaxHighlighter.registerLanguage('diff', diff);
CodeBlockSyntaxHighlighter.registerLanguage('docker', docker);
CodeBlockSyntaxHighlighter.registerLanguage('graphql', graphql);
CodeBlockSyntaxHighlighter.registerLanguage('ini', ini);
CodeBlockSyntaxHighlighter.registerLanguage('javascript', javascript);
CodeBlockSyntaxHighlighter.registerLanguage('json', json);
CodeBlockSyntaxHighlighter.alias('json', 'jsonc');
CodeBlockSyntaxHighlighter.registerLanguage('json5', json5);
CodeBlockSyntaxHighlighter.registerLanguage('jsx', jsx);
CodeBlockSyntaxHighlighter.registerLanguage('markup', markup);
CodeBlockSyntaxHighlighter.registerLanguage('markdown', markdown);
CodeBlockSyntaxHighlighter.registerLanguage('python', python);
CodeBlockSyntaxHighlighter.registerLanguage('scss', scss);
CodeBlockSyntaxHighlighter.registerLanguage('sql', sql);
CodeBlockSyntaxHighlighter.registerLanguage('toml', toml);
CodeBlockSyntaxHighlighter.registerLanguage('tsx', tsx);
CodeBlockSyntaxHighlighter.registerLanguage('typescript', typescript);
CodeBlockSyntaxHighlighter.registerLanguage('yaml', yaml);

/**
 * Returns the Prism style map for the resolved code block theme.
 * @param resolvedCodeBlockTheme The active code block theme.
 * @returns A Prism style map with code block token layout fixes applied.
 */
export const getCodeBlockHighlightStyle = (
  resolvedCodeBlockTheme: IResolvedCodeBlockTheme,
): ICodeBlockHighlightStyle => getSyntaxHighlightStyle(resolvedCodeBlockTheme);

/**
 * Tracks the active code block syntax theme across document and system theme changes.
 * @returns The resolved code block theme for the current browser environment.
 */
export const useResolvedCodeBlockTheme = (): IResolvedCodeBlockTheme =>
  useResolvedSyntaxHighlightTheme();
