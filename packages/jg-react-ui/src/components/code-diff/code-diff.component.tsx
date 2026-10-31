import { memo, useCallback, useMemo } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';
import { isBreakpointAtLeast, useBreakpoint } from 'jg-react';

import { useUiPreferencesStore } from '../../shared/ui-preferences/index.js';
import ReactDiffViewer, { DiffMethod } from '../../vendor/diff-viewer.js';
import { CodePreferencesControls } from '../code-preferences-controls/index.js';
import { CodeFileHeader } from '../typography/index.js';
import { useTheme } from '../theme-provider/index.js';
import { useUiPreferencesCapabilities } from '../ui-preferences-provider/index.js';
import {
  CodeDiffSyntaxHighlighter,
  getCodeDiffHighlightStyle,
  useResolvedCodeDiffCodeTheme,
} from './code-highlighting.js';
import { DEFAULT_RESPONSIVE_BREAKPOINT } from './constants.js';
import type { ICodeDiffProps } from './types.js';
import {
  canComputeCodeDiffSynchronously,
  normalizeCodeDiffHighlightStyle,
  resolveCodeDiffStyles,
} from './utilities.js';

// stable viewer props keep unrelated provider saves from repeating row tokenization.
const MemoizedDiffViewer = memo(ReactDiffViewer);

/**
 * Renders the default collapsed-lines affordance for unchanged code sections.
 * @param totalFoldedLines The number of hidden unchanged lines.
 * @returns A React element describing the collapsed diff block.
 */
const renderDefaultCodeFoldMessage = (totalFoldedLines: number): React.ReactElement => (
  <span className="text-secondary-foreground text-xs font-medium">
    {`Show ${totalFoldedLines} unchanged ${totalFoldedLines === 1 ? 'line' : 'lines'}`}
  </span>
);

/**
 * Renders the default loading state while a large diff is being computed.
 * @returns A React element that communicates the diff is still loading.
 */
const renderDefaultLoadingElement = (): React.ReactElement => (
  <div
    role="status"
    aria-live="polite"
    className="text-secondary-foreground flex min-h-28 items-center justify-center px-4 py-6 text-sm"
  >
    Computing code diff...
  </div>
);

/**
 * Renders a theme-aware code diff with responsive split view and optional syntax highlighting.
 * @param props The code diff content and optional viewer controls.
 * @returns A React element that renders the diff between two strings.
 * @example
 * import { createElement } from 'react';
 * import { CodeDiff } from 'jg-react-ui/components/code-diff';
 * const example = createElement(CodeDiff, { oldValue: 'const count = 1;', newValue: 'const count = 2;' });
 * @throws
 * - THEME_PROVIDER_MISSING: useTheme must be used within a ThemeProvider
 */
export const CodeDiff = ({
  className,
  tabIndex,
  filePath,
  fileIcon,
  fileStatus,
  headerLabel,
  headerMeta,
  codeDiffView: codeDiffViewOverride,
  codeFoldMessageRenderer,
  disableWorker,
  extraLinesSurroundingDiff = 3,
  language = 'text',
  loadingElement,
  newValue,
  oldValue,
  responsiveBreakpoint = DEFAULT_RESPONSIVE_BREAKPOINT,
  showDiffOnly = true,
  styles,
  ...props
}: ICodeDiffProps): React.ReactElement => {
  const { resolvedTheme } = useTheme();
  const { canUpdatePreferences } = useUiPreferencesCapabilities();
  const codeDiffView = useUiPreferencesStore(
    (state) => codeDiffViewOverride ?? state.uiPreferences.codeDiffView,
  );
  const breakpoint = useBreakpoint();
  const resolvedCodeDiffCodeTheme = useResolvedCodeDiffCodeTheme();
  const isResponsiveLayoutReady = isBreakpointAtLeast(breakpoint, responsiveBreakpoint);
  const canChangeCodeDiffView =
    isResponsiveLayoutReady && canUpdatePreferences && codeDiffViewOverride === undefined;
  const hasFileHeader = Boolean(filePath?.trim() || headerLabel);
  const shouldSplitView = codeDiffView === 'split';
  const effectiveSplitView = shouldSplitView && isResponsiveLayoutReady;
  const syntaxHighlightStyle = useMemo(
    () => normalizeCodeDiffHighlightStyle(getCodeDiffHighlightStyle(resolvedCodeDiffCodeTheme)),
    [resolvedCodeDiffCodeTheme],
  );
  const resolvedStyles = useMemo(() => resolveCodeDiffStyles(styles), [styles]);
  const effectiveDisableWorker = useMemo(
    () => disableWorker ?? canComputeCodeDiffSynchronously(oldValue, newValue),
    [disableWorker, oldValue, newValue],
  );

  const renderContent = useCallback(
    (source: string): React.ReactElement => (
      <CodeDiffSyntaxHighlighter
        PreTag="span"
        CodeTag="span"
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          },
        }}
        customStyle={{
          background: 'transparent',
          display: 'inline',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          margin: 0,
          padding: 0,
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        language={language}
        style={syntaxHighlightStyle}
      >
        {source.length > 0 ? source : ' '}
      </CodeDiffSyntaxHighlighter>
    ),
    [language, syntaxHighlightStyle],
  );

  return (
    <div
      data-slot="code-diff"
      data-code-diff-view={effectiveSplitView ? 'split' : 'unified'}
      className={cn(
        'group/code-preferences bg-background shadow-surface border-border relative w-full min-w-0 max-w-full overflow-hidden rounded-lg border',
        className,
      )}
    >
      {hasFileHeader ? (
        <CodeFileHeader
          data-slot="code-diff-header"
          filePath={filePath}
          fileIcon={fileIcon}
          fileStatus={fileStatus}
          headerLabel={headerLabel}
          headerMeta={headerMeta}
          actions={
            canChangeCodeDiffView ? (
              <CodePreferencesControls
                canChangeCodeDiffView
                codeDiffView={codeDiffView}
                isInline
                prefersWrappedCode
              />
            ) : undefined
          }
        />
      ) : (
        <CodePreferencesControls
          canChangeCodeDiffView={canChangeCodeDiffView}
          codeDiffView={codeDiffView}
          prefersWrappedCode
        />
      )}
      <div
        data-slot="code-diff-content"
        tabIndex={tabIndex}
        className="focus-visible:outline-foreground min-w-0 max-w-full overflow-x-auto outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid"
      >
        <MemoizedDiffViewer
          {...props}
          codeFoldMessageRenderer={codeFoldMessageRenderer ?? renderDefaultCodeFoldMessage}
          compareMethod={DiffMethod.WORDS_WITH_SPACE}
          disableWorker={effectiveDisableWorker}
          extraLinesSurroundingDiff={extraLinesSurroundingDiff}
          loadingElement={loadingElement ?? renderDefaultLoadingElement}
          newValue={newValue}
          oldValue={oldValue}
          renderContent={renderContent}
          showDiffOnly={showDiffOnly}
          splitView={effectiveSplitView}
          styles={resolvedStyles}
          useDarkTheme={resolvedTheme === 'dark'}
        />
      </div>
    </div>
  );
};
