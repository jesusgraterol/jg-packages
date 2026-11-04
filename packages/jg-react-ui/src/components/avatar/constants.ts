// each avatar side, with the fallback initial's size and the inset logo's side
export const AVATAR_SIZE_CLASS_NAMES = {
  xs: 'size-4 rounded-sm text-[0.625rem] [&_[data-fit=inset]]:size-3',
  sm: 'size-5 rounded-sm text-xs [&_[data-fit=inset]]:size-3.5',
  md: 'size-7 rounded-lg text-xs [&_[data-fit=inset]]:size-4',
  lg: 'size-9 rounded-xl text-sm [&_[data-fit=inset]]:size-5',
  xl: 'size-11 rounded-xl text-base [&_[data-fit=inset]]:size-6',
} as const;

// each avatar side in pixels, for the image's intrinsic size
export const AVATAR_SIZE_PIXELS = { xs: 16, sm: 20, md: 28, lg: 36, xl: 44 } as const;
