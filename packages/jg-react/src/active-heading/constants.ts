/*
 * How far below the offset a heading's top may be and still count as reached, in pixels, so a
 * heading the browser scrolled to, with rounding or a scroll margin slightly smaller than the
 * offset, is the active one.
 */
export const ACTIVE_HEADING_TOLERANCE_PX = 16;

// the share of the viewport's bottom the observer ignores, so a heading counts once it's near the top
export const OBSERVER_BOTTOM_MARGIN = '-65%';
