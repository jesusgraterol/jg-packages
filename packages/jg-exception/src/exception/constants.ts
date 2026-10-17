/*
 * The brand every Exception carries. `Symbol.for` returns the same symbol in every copy of the
 * package, so `isException` recognises exceptions created by another installed copy.
 */
export const EXCEPTION_BRAND = Symbol.for('jg-exception.Exception');
