import type { IColumnFilter, IRowId } from '../shared/index.js';

// what listByCursor lists
export type ICursorListingOptions = {
  // the table's name, quoted in the SQL
  table: string;

  // the columns to select, each quoted in the SQL
  columns: readonly string[];

  // the unique column the pages follow, such as an ascending ID. Defaults to 'id'
  cursorColumn?: string;

  // the order rows come in. Defaults to 'DESC', newest first for ascending IDs
  sortDirection?: 'ASC' | 'DESC';

  // equality conditions every listed row meets
  filters?: readonly IColumnFilter[];

  // the cursor column's value on the last row of the previous page, or undefined for the first
  after?: IRowId | undefined;

  // the most rows to return
  limit: number;
};

// a page of rows, and the cursor of the next page, or null when this is the last
export type ICursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
