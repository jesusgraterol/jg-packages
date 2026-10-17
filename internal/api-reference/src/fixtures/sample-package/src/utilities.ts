import { ERRORS } from './constants.js';
import type { IPoint } from './types.js';

/**
 * Moves a point by an offset.
 * @param point The point to move.
 * @param offset The distance to add to both coordinates.
 * @returns The moved point.
 * @example
 * movePoint({ x: 1, y: 2 }, 3); // { x: 4, y: 5 }
 * @throws
 * - INVALID_POINT: The point is not valid.
 */
export const movePoint = (point: IPoint, offset = 1): IPoint => {
  if (!Number.isFinite(point.x)) {
    throw new Error(ERRORS.INVALID_POINT);
  }
  return { x: point.x + offset, y: point.y + offset };
};

/**
 * Describes a point without an example.
 * @param point The point to describe.
 * @returns The description.
 */
export const describePoint = (point: IPoint): string => `${point.x},${point.y}`;

export const undocumentedDistance = (a: IPoint, b: IPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Formats a point.
 * @deprecated Use `describePoint` instead.
 * @param point The point to format.
 * @returns The formatted point.
 * @example
 * formatPoint({ x: 1, y: 2 }); // '(1, 2)'
 */
export function formatPoint(point: IPoint): string;
/**
 * Formats a point with a prefix.
 * @param point The point to format.
 * @param prefix Text placed before the point.
 * @returns The formatted point.
 * @example
 * formatPoint({ x: 1, y: 2 }, 'at'); // 'at (1, 2)'
 */
export function formatPoint(point: IPoint, prefix: string): string;
export function formatPoint(point: IPoint, prefix?: string): string {
  return `${prefix === undefined ? '' : `${prefix} `}(${point.x}, ${point.y})`;
}
