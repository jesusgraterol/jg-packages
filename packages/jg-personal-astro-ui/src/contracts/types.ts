// a caller-owned documentation destination
export interface IDocumentationLink {
  href: string;
  label: string;
}

// a named group of documentation destinations, rendered in the supplied order
export interface IDocumentationNavigationGroup {
  label: string;
  items: readonly IDocumentationLink[];
}

// one entry of a finite, acyclic outline; children retain their hierarchy
export interface IDocumentationOutlineItem extends IDocumentationLink {
  children?: readonly IDocumentationOutlineItem[] | undefined;
}

// an adjacent page with optional supporting context
export interface IPageNavigationLink extends IDocumentationLink {
  description?: string | undefined;
}

// caller-supplied file presentation; no repository state is inferred
export type IFileStatus = 'added' | 'modified' | 'removed' | 'unchanged';

// one file or directory in a supplied preview, with optional real navigation
export type IFileTreeEntry = {
  name: string;
  href?: string | undefined;
  status?: IFileStatus | undefined;
} & ({ kind: 'file' } | { kind: 'directory'; children: readonly IFileTreeEntry[] });

// optional display roles independent of a provider or participant's identity
export type IConversationRole = 'user' | 'assistant' | 'system' | 'tool';

// supplied process presentation, independent of execution or persisted workflow state
export type IProcessStatus = 'pending' | 'current' | 'complete' | 'error';

// semantic presentation of a caller-owned result
export type IResultSummaryTone = 'neutral' | 'success' | 'warning' | 'danger';
