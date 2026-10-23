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
