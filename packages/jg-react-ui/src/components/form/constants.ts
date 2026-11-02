/** Source-compatible form validation defaults for application form controllers: a field is
 * checked once it loses focus the first time, then at every change, so its error shows only after
 * the operator left it and goes away as soon as they fix it.
 * @see Input
 */
export const DEFAULT_FORM_PROPS = {
  mode: 'onTouched',
} as const;
