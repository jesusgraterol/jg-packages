// a property whose animation moves or resizes an element
export type ISpatialProperty = 'transform' | 'translate' | 'scale' | 'rotate' | 'width' | 'height';

// one running animation that moves or resizes an element
export type IMovingAnimation = {
  // the animated element's tag name, in lowercase
  tagName: string;

  // the element's `data-slot` attribute, which component libraries such as shadcn/ui set to name
  // the part, or null when it has none
  slot: string | null;

  // the spatial properties it changes
  properties: ISpatialProperty[];

  // how many times it plays, or 'infinite'
  iterations: number | 'infinite';

  // how long one iteration lasts, in milliseconds, or null when the duration is 'auto'
  durationMs: number | null;
};

// what inspectMotion finds in the page
export type IMotionInspection = {
  // whether the page sees `prefers-reduced-motion: reduce`
  prefersReducedMotion: boolean;

  // every running animation that moves or resizes an element
  movingAnimations: IMovingAnimation[];
};
