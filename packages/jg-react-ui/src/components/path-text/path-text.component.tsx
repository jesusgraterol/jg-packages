import { Fragment } from 'react';
import type * as React from 'react';

import type { IPathTextProps } from './types.js';
import { splitAtSeparators } from './utilities.js';

/**
 * Renders a path or identifier that wraps after its separators, `/`, `\`, `_`, `.` and `-`,
 * rather than inside a name, with `<wbr>` break opportunities that copying the text leaves out.
 * It renders text alone, so it takes the styles of the element it sits in.
 * @param props The path.
 * @returns A React element that renders the path's text.
 * @example
 * import { createElement } from 'react';
 * import { PathText } from 'jg-react-ui/components/path-text';
 * const example = createElement('code', null, createElement(PathText, { path: '/home/me/projects/app' }));
 */
export const PathText = ({ path }: IPathTextProps): React.ReactElement => (
  <>
    {splitAtSeparators(path).map((piece, index) => (
      <Fragment key={index}>
        {index > 0 ? <wbr /> : null}
        {piece}
      </Fragment>
    ))}
  </>
);
