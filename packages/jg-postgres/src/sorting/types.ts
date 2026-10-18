import type { IColumnFilter } from '../shared/index.js';

// an ordered list: the rows of a table, or of one group in it, ordered by a column
export type IOrderedList = {
  // the table's name
  table: string;

  // the column the rows are ordered by. Defaults to 'sort_order'
  sortOrderColumn?: string;

  // equality conditions that pick one ordered list when a table holds several, such as
  // [{ column: 'group_id', value: 1 }]
  scope?: readonly IColumnFilter[];
};

// what moveUp and moveDown move within
export type IMoveOptions = IOrderedList & {
  // the unique constraint on the sort order column, which must be DEFERRABLE, so two rows can
  // swap their values
  sortOrderConstraint: string;

  // the column that identifies the row. Defaults to 'id'
  idColumn?: string;
};

// what the move query reports
export type IMoveStatus = {
  has_current: boolean;
  has_neighbor: boolean;
  updated_count: number;
};
