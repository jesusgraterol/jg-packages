// caller-owned source and caption for one side of a comparison
export interface IDiffSide {
  code: string;
  title: string;
}

// build-time presentation options; defaults preserve the existing responsive comparison
export interface ICodeDiffProps {
  after: IDiffSide;
  before: IDiffSide;
  class?: string | undefined;
  lang: string;
  view?: 'auto' | 'split' | 'unified' | undefined;
  lineNumbers?: boolean | undefined;
  contextLines?: number | undefined;
  highlightWords?: boolean | undefined;
  appearance?: 'plain' | 'window' | undefined;
  overflow?: 'scroll' | 'wrap' | undefined;
}

// UTF-16 offsets into a source line, matching JavaScript string slicing and the diff library
export interface IWordRange {
  start: number;
  end: number;
}

// raw text remains authoritative; display text excludes its original line terminator
export interface IDiffSourceLine {
  raw: string;
  text: string;
  ending: 'cr' | 'crlf' | 'lf' | 'none';
  lineNumber: number;
  wordRanges: IWordRange[];
}

// shared context uses the after source; beforeStart preserves its independent original numbering
export interface IDiffContext {
  type: 'context';
  beforeStart: number;
  afterStart: number;
  lines: IDiffSourceLine[];
}

// consecutive removals/additions share a block so all views pair the same source lines
export interface IDiffChange {
  type: 'change';
  before: IDiffSourceLine[];
  after: IDiffSourceLine[];
}

// the exact unchanged source interval represented by one omission notice in either view
export interface IDiffOmission {
  type: 'omitted';
  beforeStart: number;
  afterStart: number;
  count: number;
}
export type IDiffChunk = IDiffChange | IDiffContext | IDiffOmission;

// one comparison owns its source and model; there is no cross-build source cache
export interface IDiffModel {
  beforeLines: IDiffSourceLine[];
  afterLines: IDiffSourceLine[];
  chunks: IDiffChunk[];
  isFallback: boolean;
  hasChanges: boolean;
}

// paired markup retains placeholder and final-newline geometry across split columns
export interface IDiffRenderedRow {
  before: string;
  after: string;
  isOmitted: boolean;
}
export interface IDiffMarkup {
  unified: string;
  rows: IDiffRenderedRow[];
}
