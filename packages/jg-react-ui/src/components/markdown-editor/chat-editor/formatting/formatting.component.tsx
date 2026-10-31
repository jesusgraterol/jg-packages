import { useRef, useCallback } from 'react';
import type * as React from 'react';
import { Heading1, Heading2, Heading3, List, ListOrdered, Pilcrow, Type } from 'lucide-react';

import { Button } from '../../../button/index.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../dropdown-menu/index.js';

import type { IChatMarkdownBlockFormat } from '../types.js';
import type { IChatMarkdownFormattingProps } from './types.js';

const CHAT_MARKDOWN_FORMAT_OPTIONS = [
  { format: 'paragraph', icon: Pilcrow, label: 'Text' },
  { format: 'heading-1', icon: Heading1, label: 'Heading 1' },
  { format: 'heading-2', icon: Heading2, label: 'Heading 2' },
  { format: 'heading-3', icon: Heading3, label: 'Heading 3' },
  { format: 'bullet-list', icon: List, label: 'Bulleted list' },
  { format: 'ordered-list', icon: ListOrdered, label: 'Numbered list' },
] as const satisfies ReadonlyArray<{
  format: IChatMarkdownBlockFormat;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
  label: string;
}>;

/**
 * Renders the keyboard-accessible block formatting menu for a chat editor.
 * @param props The live editor controls and disabled state.
 * @returns A compact dropdown trigger and supported block-format actions.
 */
export const ChatMarkdownFormatting = ({
  controlsRef,
  disabled,
  onFormatApplied,
}: IChatMarkdownFormattingProps): React.ReactElement => {
  const hasAppliedFormatRef = useRef(false);
  const handleFormat = useCallback(
    (format: IChatMarkdownBlockFormat): void => {
      hasAppliedFormatRef.current = true;
      controlsRef.current?.applyBlockFormat(format);
      onFormatApplied?.(format);
    },
    [controlsRef, onFormatApplied],
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event): void => {
      if (hasAppliedFormatRef.current) {
        hasAppliedFormatRef.current = false;
        event.preventDefault();
        controlsRef.current?.focus();
      }
    },
    [controlsRef],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          aria-label="Format message"
          disabled={disabled}
          size="icon-touch"
          variant="ghost"
        >
          <Type aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DropdownMenuLabel>Block style</DropdownMenuLabel>
        {CHAT_MARKDOWN_FORMAT_OPTIONS.map(({ format, icon: Icon, label }) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleFormat(format)}
          >
            <Icon
              aria-hidden="true"
              className="size-4 shrink-0"
            />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
