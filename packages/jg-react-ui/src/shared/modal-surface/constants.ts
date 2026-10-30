// shared backdrop surface styling keeps every modal visually aligned.
export const MODAL_BACKDROP_SURFACE_CLASS_NAME =
  'fixed inset-0 z-50 bg-black/45 backdrop-blur-xs will-change-[opacity] dark:bg-black/70';

// keyframe motion is shared by modal primitives whose content exits at the same duration.
export const MODAL_BACKDROP_KEYFRAME_MOTION_CLASS_NAME =
  'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:duration-200 data-closed:ease-in data-open:duration-300 data-open:ease-out motion-reduce:animate-none motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none';

// compact modal close controls stay outside document flow while preserving a touch-friendly target.
export const COMPACT_MODAL_CLOSE_BUTTON_CLASS_NAME =
  "absolute top-2 right-2 z-10 after:absolute after:-inset-2 after:content-[''] pointer-coarse:min-h-11 pointer-coarse:min-w-11";
