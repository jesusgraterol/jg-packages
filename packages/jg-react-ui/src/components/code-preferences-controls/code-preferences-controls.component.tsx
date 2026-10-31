import { useState, useCallback } from 'react';
import type * as React from 'react';
import { Columns2, MoveHorizontal, Rows3, WrapText } from 'lucide-react';
import { cn } from 'cnfast';

import type { ICodeDiffView } from '../../contracts/index.js';

import { Button } from '../button/index.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../dropdown-menu/index.js';
import { useUiPreferencesCapabilities } from '../ui-preferences-provider/index.js';
import type { ICodePreferencesControlsProps } from './types.js';

/**
 * Renders compact menus that optimistically update shared code-view preferences.
 * @param props The visible preference menus, presentation, and current values.
 * @returns A control group containing the enabled preference menus.
 * @example
 * import { createElement } from 'react';
 * import { CodePreferencesControls } from 'jg-react-ui/components/code-preferences-controls';
 * const example = createElement(CodePreferencesControls, { prefersWrappedCode: false, canChangePrefersWrappedCode: true, isInline: true });
 */
export const CodePreferencesControls = ({
  canChangeCodeDiffView = false,
  canChangePrefersWrappedCode = false,
  className,
  codeDiffView,
  isInline = false,
  prefersWrappedCode,
}: ICodePreferencesControlsProps): React.ReactElement | null => {
  const { updatePreferences } = useUiPreferencesCapabilities();
  const [isCodeDiffViewMenuOpen, setIsCodeDiffViewMenuOpen] = useState(false);
  const [isCodeLineLayoutMenuOpen, setIsCodeLineLayoutMenuOpen] = useState(false);
  const CodeDiffViewIcon = codeDiffView === 'unified' ? Rows3 : Columns2;
  const CodeLineLayoutIcon = prefersWrappedCode ? WrapText : MoveHorizontal;
  const codeDiffViewLabel = codeDiffView === 'unified' ? 'Unified' : 'Split';
  const codeLineLayoutLabel = prefersWrappedCode ? 'Wrap' : 'Scroll';

  /**
   * Updates the diff layout while preserving every other current preference.
   * @param nextCodeDiffView The selected diff layout.
   */
  const handleCodeDiffViewChange = useCallback(
    (nextCodeDiffView: ICodeDiffView): void => {
      if (codeDiffView === nextCodeDiffView) {
        return;
      }

      updatePreferences({ codeDiffView: nextCodeDiffView });
    },
    [codeDiffView, updatePreferences],
  );

  /**
   * Updates code wrapping while preserving every other current preference.
   * @param nextPrefersWrappedCode Whether code surfaces should wrap long lines.
   */
  const handlePrefersWrappedCodeChange = useCallback(
    (nextPrefersWrappedCode: boolean): void => {
      updatePreferences({ prefersWrappedCode: nextPrefersWrappedCode });
    },
    [updatePreferences],
  );

  const handleSplitViewCheckedChange = useCallback((): void => {
    handleCodeDiffViewChange('split');
  }, [handleCodeDiffViewChange]);

  const handleUnifiedViewCheckedChange = useCallback((): void => {
    handleCodeDiffViewChange('unified');
  }, [handleCodeDiffViewChange]);

  /**
   * Converts the selected line-layout value into the shared wrapping preference.
   * @param nextCodeLineLayout The selected line-layout value.
   */
  const handleCodeLineLayoutChange = useCallback(
    (nextCodeLineLayout: string): void => {
      if (nextCodeLineLayout === 'scroll') {
        handlePrefersWrappedCodeChange(false);
      } else if (nextCodeLineLayout === 'wrap') {
        handlePrefersWrappedCodeChange(true);
      }
    },
    [handlePrefersWrappedCodeChange],
  );

  if (!canChangeCodeDiffView && !canChangePrefersWrappedCode) {
    return null;
  }

  return (
    <div
      data-slot="code-preferences-controls"
      data-menu-open={isCodeDiffViewMenuOpen || isCodeLineLayoutMenuOpen}
      className={cn(
        'z-10 flex items-center gap-1',
        isInline
          ? 'shrink-0'
          : 'absolute top-2 right-2 opacity-100 transition-opacity duration-150 ease-out group-hover/code-preferences:opacity-100 focus-within:opacity-100 data-[menu-open=true]:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:opacity-0',
        className,
      )}
    >
      {canChangeCodeDiffView ? (
        <DropdownMenu onOpenChange={setIsCodeDiffViewMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Code diff view: ${codeDiffViewLabel}`}
              className={cn('pointer-coarse:size-11', !isInline && 'bg-background/90 shadow-xs')}
              size="icon-xs"
              title={`Code diff view: ${codeDiffViewLabel}`}
              type="button"
              variant={isInline ? 'ghost' : 'outline'}
            >
              <CodeDiffViewIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="min-w-40"
          >
            <DropdownMenuLabel>Code diff view</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={codeDiffView === 'split'}
              onCheckedChange={handleSplitViewCheckedChange}
            >
              <Columns2
                aria-hidden="true"
                className="size-3.5"
              />
              Split
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={codeDiffView === 'unified'}
              onCheckedChange={handleUnifiedViewCheckedChange}
            >
              <Rows3
                aria-hidden="true"
                className="size-3.5"
              />
              Unified
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {canChangePrefersWrappedCode ? (
        <DropdownMenu onOpenChange={setIsCodeLineLayoutMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Line wrapping: ${codeLineLayoutLabel}`}
              className={cn('pointer-coarse:size-11', !isInline && 'bg-background/90 shadow-xs')}
              size="icon-xs"
              title={`Line wrapping: ${codeLineLayoutLabel}`}
              type="button"
              variant={isInline ? 'ghost' : 'outline'}
            >
              <CodeLineLayoutIcon
                aria-hidden="true"
                className={isInline ? 'size-4' : undefined}
              />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="min-w-40"
          >
            <DropdownMenuLabel>Line wrapping</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={prefersWrappedCode ? 'wrap' : 'scroll'}
              onValueChange={handleCodeLineLayoutChange}
            >
              <DropdownMenuRadioItem value="scroll">
                <MoveHorizontal
                  aria-hidden="true"
                  className="size-3.5"
                />
                Scroll horizontally
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="wrap">
                <WrapText
                  aria-hidden="true"
                  className="size-3.5"
                />
                Wrap lines
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
};
