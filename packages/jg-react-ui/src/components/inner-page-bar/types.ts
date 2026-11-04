import type * as React from 'react';
import type { IPageReturn } from 'jg-react-router';

/** Options for InnerPageBar: the page's title, the app's page return, the page Back leads to
 * otherwise with its name, and the page's own actions.
 * @see InnerPageBar
 */
export type IInnerPageBarProps = {
  title: string;
  pageReturn: IPageReturn;
  parentHref: string;
  parentLabel: string;
  actions?: React.ReactNode;
};
