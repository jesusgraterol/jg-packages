// what useSearchParamDialog returns
export type ISearchParamDialog = {
  // the ID of what the open dialog shows, or an empty string while it's closed
  openId: string;

  // opens the dialog on an ID, adding a history entry
  open: (id: string) => void;

  // closes the dialog: back past the entry its opening added, or in place
  close: () => void;
};
