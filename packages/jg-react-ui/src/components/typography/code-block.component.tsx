import { memo, useMemo } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';

import { useUiPreferencesStore } from '../../shared/ui-preferences/index.js';
import { CodePreferencesControls } from '../code-preferences-controls/index.js';
import { CopyButton } from '../copy-button/index.js';
import { useUiPreferencesCapabilities } from '../ui-preferences-provider/index.js';
import { CodeFileHeader } from './code-file-header/index.js';
import {
  CodeBlockSyntaxHighlighter,
  getCodeBlockHighlightStyle,
  useResolvedCodeBlockTheme,
} from './code-highlighting.js';
import { codeBlockContentClassNames } from './constants.js';
import { createDiffRenderer } from './diff-renderer.js';
import type { ICodeBlockProps } from './types.js';
import { extractCodeText, isCodeBlockProse, resolveCodeBlockLanguageLabel } from './utilities.js';

// expensive tokenization only reruns when source, theme, layout, or native props change.
const MemoizedSyntaxHighlighter = memo(CodeBlockSyntaxHighlighter);

/**
 * Renders a syntax-highlighted code block using the active theme.
 * @param props The code block props, source metadata, language, wrapping, and code children.
 * @returns A React element that renders the code block.
 * @example
 * import { createElement } from 'react';
 * import { CodeBlock } from 'jg-react-ui/components/typography';
 * const example = createElement(CodeBlock, { language: 'typescript', filePath: 'src/agent.ts', children: 'const isReady = true;' });
 */
export const CodeBlock = ({
  className,
  children,
  copyValue,
  copyLabel,
  filePath,
  headerLabel,
  headerRole,
  headerMeta,
  fileIcon,
  fileStatus,
  hasHeader = true,
  hasCopyButton = true,
  hasPreferencesControls = true,
  hasSyntaxHighlighting = true,
  language: declaredLanguage,
  prefersWrappedCode: prefersWrappedCodeOverride,
  shouldWrapContent,
  style,
  ...props
}: ICodeBlockProps): React.ReactElement => {
  const resolvedCodeBlockTheme = useResolvedCodeBlockTheme();
  const { canUpdatePreferences } = useUiPreferencesCapabilities();
  const language = declaredLanguage ?? 'text';
  const hasAutomaticProseWrapping = isCodeBlockProse(filePath, declaredLanguage);
  const effectivePrefersWrappedCode = useUiPreferencesStore(
    (state) =>
      prefersWrappedCodeOverride ??
      shouldWrapContent ??
      (hasAutomaticProseWrapping || state.uiPreferences.prefersWrappedCode),
  );
  const canChangePrefersWrappedCode =
    canUpdatePreferences &&
    prefersWrappedCodeOverride === undefined &&
    shouldWrapContent === undefined &&
    !hasAutomaticProseWrapping;
  const contentClassName = effectivePrefersWrappedCode
    ? codeBlockContentClassNames.wrap
    : codeBlockContentClassNames.overflow;
  const codeText = useMemo(() => extractCodeText(children), [children]);
  const languageLabel = resolveCodeBlockLanguageLabel(language);
  const codeBlockHighlightStyle = hasSyntaxHighlighting
    ? getCodeBlockHighlightStyle(resolvedCodeBlockTheme)
    : undefined;
  const isDiff = language === 'diff' || language.startsWith('diff-');
  const sourceLanguage = isDiff ? language.slice(5) || undefined : undefined;
  const diffRenderer = useMemo(
    () => (hasSyntaxHighlighting && isDiff ? createDiffRenderer(sourceLanguage) : undefined),
    [hasSyntaxHighlighting, isDiff, sourceLanguage],
  );

  const codeTagProps = useMemo<{ style: React.CSSProperties }>(
    () => ({
      style: {
        fontFamily: 'var(--font-mono, monospace)',
        ...(isDiff && {
          color: 'var(--foreground)',
          display: 'block',
          minWidth: '100%',
          width: effectivePrefersWrappedCode ? '100%' : 'max-content',
        }),
      },
    }),
    [isDiff, effectivePrefersWrappedCode],
  );
  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      margin: 0,
      background: 'var(--background)',
      borderRadius: 0,
      padding: isDiff ? 0 : '1rem',
    }),
    [isDiff],
  );

  return (
    <div
      data-slot="code-block"
      className={cn(
        'group/code-preferences relative mt-6 min-w-0 max-w-full overflow-hidden rounded-md border border-border text-sm',
        className,
      )}
      style={style}
    >
      {hasHeader ? (
        <CodeFileHeader
          data-slot="code-block-header"
          filePath={filePath}
          fileIcon={fileIcon}
          fileStatus={fileStatus}
          headerLabel={headerLabel}
          headerRole={headerRole}
          headerMeta={headerMeta}
          languageLabel={languageLabel}
          actions={
            hasPreferencesControls || hasCopyButton ? (
              <div
                data-slot="code-block-actions"
                className="flex shrink-0 items-center gap-1"
              >
                {hasPreferencesControls ? (
                  <CodePreferencesControls
                    canChangePrefersWrappedCode={canChangePrefersWrappedCode}
                    isInline
                    prefersWrappedCode={effectivePrefersWrappedCode}
                  />
                ) : null}
                {hasCopyButton ? (
                  <CopyButton
                    size="icon-xs"
                    className="pointer-coarse:size-11"
                    value={copyValue ?? codeText}
                    {...(copyLabel === undefined ? {} : { copyLabel })}
                  />
                ) : null}
              </div>
            ) : undefined
          }
        />
      ) : null}
      {hasSyntaxHighlighting ? (
        <MemoizedSyntaxHighlighter
          {...props}
          tabIndex={props.tabIndex ?? (effectivePrefersWrappedCode ? undefined : 0)}
          className={cn(
            contentClassName,
            'focus-visible:outline-foreground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid',
          )}
          codeTagProps={codeTagProps}
          customStyle={contentStyle}
          language={isDiff ? 'diff' : language}
          {...(codeBlockHighlightStyle ? { style: codeBlockHighlightStyle } : {})}
          {...(isDiff && diffRenderer ? { renderer: diffRenderer } : {})}
          wrapLongLines={effectivePrefersWrappedCode}
        >
          {codeText}
        </MemoizedSyntaxHighlighter>
      ) : (
        <pre
          {...props}
          tabIndex={props.tabIndex ?? (effectivePrefersWrappedCode ? undefined : 0)}
          className={cn(
            contentClassName,
            'bg-background focus-visible:outline-foreground m-0 rounded-none p-4 font-mono outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid',
            effectivePrefersWrappedCode ? 'whitespace-pre-wrap' : 'whitespace-pre',
          )}
        >
          <code>{codeText}</code>
        </pre>
      )}
    </div>
  );
};
