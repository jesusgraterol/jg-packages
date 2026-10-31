import type * as React from 'react';
import { cn } from 'cnfast';
import { FileCodeCorner, FileJson, FileText } from 'lucide-react';

import { formatRepositoryPath, InlineCode } from '../../inline-code/index.js';
import { CODE_FILE_STATUS_LABELS, codeFileStatusVariants } from '../constants.js';

import type { ICodeFileHeaderProps } from './types.js';

/**
 * Renders aligned source metadata, keeping the filename visible when its directory truncates.
 * @param props The source path, authored metadata, status, and action slots.
 * @returns The source header.
 * @example
 * import { createElement } from 'react';
 * import { CodeFileHeader } from 'jg-react-ui/components/typography';
 * const example = createElement(CodeFileHeader, { filePath: 'src/agent.ts', fileStatus: 'modified' });
 */
export const CodeFileHeader = ({
  actions,
  className,
  filePath,
  fileIcon,
  fileStatus,
  headerLabel,
  headerRole,
  headerMeta,
  languageLabel,
  ...props
}: ICodeFileHeaderProps): React.ReactElement => {
  const normalizedPath = filePath?.trim();
  // repository paths display without their leading slash; icon detection reads the exact path
  const displayPath =
    normalizedPath === undefined ? undefined : formatRepositoryPath(normalizedPath);
  const filenameStart = displayPath?.lastIndexOf('/') ?? -1;
  const directory = filenameStart < 0 ? '' : displayPath?.slice(0, filenameStart);
  const filename = filenameStart < 0 ? displayPath : displayPath?.slice(filenameStart);
  const FileIcon = /\.jsonc?(?::\d.*)?$/u.test(normalizedPath ?? '')
    ? FileJson
    : /\.(md|txt|yaml|yml)(?::\d.*)?$/u.test(normalizedPath ?? '')
      ? FileText
      : FileCodeCorner;
  const hasIcon = fileIcon !== undefined || Boolean(normalizedPath);

  /*
   * narrow headers move metadata onto its own line below the path, so a status badge
   * never takes the filename's space; wider headers keep it at the opposite end.
   */
  return (
    <div
      data-slot="code-file-header"
      {...props}
      className={cn(
        'bg-background @container/code-file-header flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-3',
        className,
      )}
    >
      {fileIcon !== undefined ? (
        <span
          className="text-secondary-foreground flex shrink-0 items-center"
          aria-hidden="true"
        >
          {fileIcon}
        </span>
      ) : normalizedPath ? (
        <FileIcon
          aria-hidden="true"
          className="text-secondary-foreground size-5 shrink-0"
        />
      ) : null}
      <div className="grid min-w-0 flex-1 gap-1">
        {headerRole ? (
          <span
            data-slot="code-file-role"
            className="text-secondary-foreground truncate text-xs"
          >
            {headerRole}
          </span>
        ) : null}
        <span
          className="min-w-0"
          title={displayPath}
          data-slot={normalizedPath ? 'code-block-file-path' : 'code-block-language'}
        >
          {headerLabel ??
            (normalizedPath ? (
              <InlineCode className="flex text-xs whitespace-nowrap">
                <span className="min-w-0 truncate">{directory}</span>
                <span className="max-w-full shrink-0 truncate">{filename}</span>
              </InlineCode>
            ) : (
              <span className="text-secondary-foreground font-mono text-xs">{languageLabel}</span>
            ))}
        </span>
      </div>
      {headerMeta ? (
        <span
          data-slot="code-file-meta"
          className={cn(
            'text-secondary-foreground order-last min-w-0 basis-full text-xs @sm/code-file-header:order-none @sm/code-file-header:max-w-1/4 @sm/code-file-header:shrink-0 @sm/code-file-header:basis-auto @sm/code-file-header:truncate @sm/code-file-header:text-right',
            hasIcon && 'pl-8 @sm/code-file-header:pl-0',
            // beside a role and path, the metadata shares the role's first line
            headerRole && '@sm/code-file-header:self-start',
          )}
        >
          {headerMeta}
        </span>
      ) : null}
      {fileStatus ? (
        <span
          aria-label={CODE_FILE_STATUS_LABELS[fileStatus].label}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold',
            codeFileStatusVariants({ status: fileStatus }),
            fileStatus === 'added'
              ? 'bg-file-added/10'
              : fileStatus === 'modified'
                ? 'bg-chart-2/15'
                : 'bg-destructive/10',
          )}
        >
          {CODE_FILE_STATUS_LABELS[fileStatus].marker}
        </span>
      ) : null}
      {actions}
    </div>
  );
};
