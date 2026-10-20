import type { Dispatch, SetStateAction } from 'react';

// what useActiveHeading takes
export type IUseActiveHeadingOptions = {
  // the ids of the headings to follow, in the order they appear on the page
  headingIds: readonly string[];

  // the height of what covers the top of the viewport, such as a sticky header, in pixels; a
  // heading is reached once its top passes this line
  topOffsetPx: number;
};

// what useActiveHeading gives
export type IUseActiveHeadingResult = {
  // the id of the heading the reader is at, or null before one is known
  activeHeadingId: string | null;

  // sets the active heading, such as when a table of contents link is clicked
  setActiveHeadingId: Dispatch<SetStateAction<string | null>>;
};
