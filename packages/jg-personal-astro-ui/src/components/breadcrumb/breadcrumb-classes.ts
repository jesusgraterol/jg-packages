// where a breadcrumb's trail sits: at the start of its column, or centered
export type IBreadcrumbAlign = 'center' | 'start';

// the trail's shared classes
const LIST_CLASSES =
  'flex flex-wrap items-center gap-1.5 font-mono text-xs font-semibold text-muted';

/**
 * Builds the classes of a breadcrumb's list of steps.
 * @param align Where the trail sits. Defaults to 'start'.
 * @returns The list's classes.
 */
export const buildBreadcrumbListClasses = (align: IBreadcrumbAlign = 'start'): string =>
  align === 'center' ? `${LIST_CLASSES} justify-center` : LIST_CLASSES;
