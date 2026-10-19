// what PageOutlet takes
export type IPageOutletProps = {
  // classes added to the frame after `jg-page-outlet`, such as the app's layout classes
  className?: string | undefined;

  // what identifies the page: a new value remounts the frame, focuses it, and scrolls to the top.
  // Defaults to the location's pathname, so a navigation that changes only the query keeps the
  // page. A parent route's own key keeps its frame while its nested routes change
  transitionKey?: string | undefined;
};
