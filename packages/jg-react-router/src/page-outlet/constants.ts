// the most Back and Forward scroll positions an outlet keeps, dropping the least recent first
export const PAGE_OUTLET_SCROLL_HISTORY_LIMIT = 128;

// the class the frame always has, which styles.css styles
export const PAGE_OUTLET_CLASS_NAME = 'jg-page-outlet';

// the input that cancels a pending restore, because the user is already moving around the page
export const RESTORE_CANCELLATION_EVENTS = [
  'wheel',
  'touchstart',
  'pointerdown',
  'keydown',
] as const;
