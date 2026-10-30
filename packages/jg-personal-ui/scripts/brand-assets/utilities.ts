import { JG_MARK_TILE, JG_MARK_VIEW_BOX } from 'jg-personal-ui/brand';

/**
 * Serializes the fixed, source-owned artwork without altering its geometry or colors.
 * @param paths The outlined paths of the mark or favicon.
 * @returns The standalone SVG with a stable trailing newline.
 */
export const renderBrandSvg = (paths: ReadonlyArray<{ fill: string; d: string }>): string => {
  const tile = Object.entries(JG_MARK_TILE)
    .map(([name, value]) => `${name}="${value}"`)
    .join(' ');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${JG_MARK_VIEW_BOX}" fill="none">`,
    `  <rect ${tile}/>`,
    ...paths.map(({ fill, d }) => `  <path fill="${fill}" d="${d}"/>`),
    '</svg>',
    '',
  ].join('\n');
};
