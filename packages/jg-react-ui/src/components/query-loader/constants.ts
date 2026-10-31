/** Query loader layouts reserve space appropriate to inline, dialog, and page feedback.
 * @see QUERY_LOADER_LAYOUT_CLASS_NAMES
 */
export const QUERY_LOADER_LAYOUT_CLASS_NAMES = {
  dialog: 'mt-0 h-[clamp(8rem,32svh,16rem)]',
  inline: 'mt-10 md:mt-16',
  page: 'pointer-events-none fixed inset-x-0 top-[var(--query-loader-page-inset-top,0px)] bottom-[var(--query-loader-page-inset-bottom,0px)] z-10 mt-0',
} as const;

/** Query loader size variants map semantic sizes to shared icon dimensions.
 * @see QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES
 */
export const QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-7',
  lg: 'size-9',
  xl: 'size-12',
} as const;
