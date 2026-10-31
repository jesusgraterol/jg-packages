import { createContext, useMemo, useContext } from 'react';
import type * as React from 'react';

// markdown preference context forwards render options to the matching default renderers.
type IMarkdownPreferencesContextValue = {
  prefersWrappedCode?: boolean | undefined;
  shouldOpenLinksInNewTab?: boolean | undefined;
};

const MarkdownPreferencesContext = createContext<IMarkdownPreferencesContextValue>({});

type IMarkdownPreferencesProviderProps = IMarkdownPreferencesContextValue & {
  children: React.ReactNode;
};

/**
 * Provides shared preferences to the default renderers inside one Markdown subtree.
 * @param props The markdown rendering preferences and rendered children.
 * @returns A provider containing the rendered markdown subtree.
 */
export const MarkdownPreferencesProvider = ({
  children,
  prefersWrappedCode,
  shouldOpenLinksInNewTab,
}: IMarkdownPreferencesProviderProps): React.ReactElement => {
  const contextValue = useMemo(
    () => ({ prefersWrappedCode, shouldOpenLinksInNewTab }),
    [prefersWrappedCode, shouldOpenLinksInNewTab],
  );

  return <MarkdownPreferencesContext value={contextValue}>{children}</MarkdownPreferencesContext>;
};

/**
 * Reads the preferences applied by the parent Markdown component.
 * @returns The default-renderer preferences for the current Markdown subtree.
 */
export const useMarkdownPreferences = (): IMarkdownPreferencesContextValue =>
  useContext(MarkdownPreferencesContext);

// preformatted context preserves unlabeled fences without intercepting custom code renderers.
export const MarkdownPreContext = createContext(false);
