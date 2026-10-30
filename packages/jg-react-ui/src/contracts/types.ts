import { z } from 'zod';

import type { createErrorFeedback } from 'jg-exception';

/** Theme preferences accepted by shared UI consumers.
 * @see IAppTheme
 */
export const AppThemeSchema = z.enum(['light', 'dark', 'system']);
/** Validated preference contract.
 * @see AppThemeSchema
 */
export type IAppTheme = z.infer<typeof AppThemeSchema>;

/** Concrete color schemes after resolving the system preference.
 * @see IResolvedAppTheme
 */
export const ResolvedAppThemeSchema = z.enum(['light', 'dark']);
/** Validated preference contract.
 * @see ResolvedAppThemeSchema
 */
export type IResolvedAppTheme = z.infer<typeof ResolvedAppThemeSchema>;

/** Retained code-diff layouts.
 * @see ICodeDiffView
 */
export const CodeDiffViewSchema = z.enum(['split', 'unified']);
/** Validated preference contract.
 * @see CodeDiffViewSchema
 */
export type ICodeDiffView = z.infer<typeof CodeDiffViewSchema>;

/** Complete stored UI preferences; harmless additional fields remain compatible.
 * @see IUiPreferences
 */
export const UiPreferencesSchema = z.object({
  theme: AppThemeSchema,
  codeDiffView: CodeDiffViewSchema,
  prefersWrappedCode: z.boolean(),
  appInstallToastrDismissedAt: z.iso.datetime().nullable(),
});
/** Validated preference contract.
 * @see UiPreferencesSchema
 */
export type IUiPreferences = z.infer<typeof UiPreferencesSchema>;

/** Application-owned error copy, cancellation, and access-loss policy.
 * @see ErrorFeedbackProvider
 */
export type IErrorFeedbackResolver = ReturnType<typeof createErrorFeedback>;
