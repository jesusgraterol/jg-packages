// the table's base look: a hairline between body rows, padded cells, and a tinted head
const TABLE_CLASSES =
  'w-full border-collapse text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:whitespace-nowrap [&_thead]:bg-secondary';

// pins each row's first cell while the rest scroll under it: opaque, above the scrolled cells, and
// ruled off from them
const STICKY_FIRST_COLUMN_CLASSES =
  '[&_tr>:first-child]:sticky [&_tr>:first-child]:left-0 [&_tr>:first-child]:z-10 [&_tr>:first-child]:border-r [&_tr>:first-child]:border-border [&_tr>:first-child]:bg-surface [&_thead_tr>:first-child]:bg-secondary';

// what buildTableClasses needs
export type ITableClassesOptions = {
  // shows the caption to screen readers only
  captionHidden?: boolean | undefined;
  // a scroll region: the wrapper keeps a wide table's sideways scroll to itself
  scrollable?: boolean | undefined;
  stickyFirstColumn?: boolean | undefined;
};

// the classes of the table's parts
export type ITableClasses = {
  caption: string;
  table: string;
  wrapper: string;
};

/**
 * Builds the classes of a table's wrapper, table, and caption.
 * @param options Whether the caption is hidden, the wrapper is a scroll region, and the first column
 * is pinned.
 * @returns The classes of each part, separated by spaces.
 */
export const buildTableClasses = ({
  captionHidden = false,
  scrollable = false,
  stickyFirstColumn = false,
}: ITableClassesOptions = {}): ITableClasses => ({
  caption: captionHidden ? 'sr-only' : 'px-4 pt-3 text-left text-xs text-muted',
  table: stickyFirstColumn ? `${TABLE_CLASSES} ${STICKY_FIRST_COLUMN_CLASSES}` : TABLE_CLASSES,
  wrapper: [
    'overflow-x-auto rounded-xl border border-border bg-surface shadow-surface',
    scrollable ? 'overscroll-x-contain' : '',
  ]
    .filter(Boolean)
    .join(' '),
});

/**
 * Builds the attributes that make a table's wrapper a scroll region: a labelled landmark that
 * keyboard users can focus and then scroll with the arrow keys.
 * @param scrollLabel The region's name, such as "Coding mode comparison", or undefined for none.
 * @returns The attributes, or none without a label.
 */
export const buildTableRegionAttributes = (
  scrollLabel: string | undefined,
): Record<string, string> =>
  scrollLabel === undefined ? {} : { 'aria-label': scrollLabel, role: 'region', tabindex: '0' };
