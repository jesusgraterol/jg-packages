// a public component's rendered example, or a head/layout behavior on that page
export interface IGalleryExample {
  subpath: string;
  path: string;
  selector: string;
}

// the gallery's small, fixed navigation inventory
export interface IGalleryPage {
  href: string;
  label: string;
  description: string;
}
