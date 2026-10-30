// shared React surface
export {
  Button,
  buttonVariants,
  cn,
  type IButtonProps,
  type IButtonBadgeLocation,
  type IButtonBadgeTheme,
  AppThemeSchema,
  ResolvedAppThemeSchema,
  CodeDiffViewSchema,
  UiPreferencesSchema,
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_STORE_ID,
  UI_PREFERENCES_STORAGE_KEY,
  type IAppTheme,
  type IResolvedAppTheme,
  type ICodeDiffView,
  type IUiPreferences,
} from 'jg-react-ui';

// badge
export { Badge, badgeVariants, type IBadgeProps } from 'jg-react-ui/components/badge';

// icon-tile
export {
  IconTile,
  iconTileVariants,
  type IIconTileProps,
  type IIconTileSize,
  type IIconTileTone,
} from 'jg-react-ui/components/icon-tile';

// alert
export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  alertVariants,
  type IAlertActionProps,
  type IAlertDescriptionProps,
  type IAlertProps,
  type IAlertTitleProps,
} from 'jg-react-ui/components/alert';

// brand mark
export { JgMark, type IJgMarkProps } from './components/jg-mark/index.js';

// scoped error policy
export {
  ErrorFeedbackProvider,
  useErrorFeedbackResolver,
  type IErrorFeedbackProviderProps,
} from './components/error-feedback-provider/index.js';
export type { IErrorFeedbackResolver } from './contracts/index.js';

// ui-preferences-provider
export {
  type ILocalUiPreferencesProviderProps,
  type IReadOnlyUiPreferencesProviderProps,
  type IRemoteUiPreferencesProviderProps,
  type IUiPreferencesContextState,
  type IUiPreferencesPersistenceAdapter,
  type IUiPreferencesProviderProps,
  type IUiPreferencesSuccessNotification,
  type IUiPreferencesUpdateOptions,
  UiPreferencesProvider,
  useUiPreferences,
  useUiPreferencesCapabilities,
} from './components/ui-preferences-provider/index.js';

// theme-provider
export {
  type IThemeChangeRequestedHandler,
  type IThemeInitializationScriptProps,
  type IThemeProviderProps,
  type IThemeProviderState,
  type IThemeToggleButtonProps,
  ThemeInitializationScript,
  ThemeProvider,
  ThemeToggleButton,
  useTheme,
} from './components/theme-provider/index.js';

// toastr
export {
  type IExternalToastr,
  type IToastrClassNames,
  type IToastrProps,
  Toastr,
  toastr,
} from './components/toastr/index.js';

// errors and preference namespaces
export { ERRORS } from './errors/index.js';
export { getUiPreferencesStorageKey } from './contracts/index.js';

// divider
// types
export type { IDividerProps } from './components/divider/index.js';

// components
export { Divider } from './components/divider/index.js';

// empty-state
// types
export type {
  IEmptyStateDescriptionProps,
  IEmptyStateProps,
  IEmptyStateTitleProps,
} from './components/empty-state/index.js';

// components
export {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from './components/empty-state/index.js';

// progress
// types
export type {
  IProgressDeterminateProps,
  IProgressIndeterminateProps,
  IProgressProps,
} from './components/progress/index.js';

// components
export { Progress } from './components/progress/index.js';

// spinner
// types
export type { ISpinnerProps } from './components/spinner/index.js';

// components
export { Spinner } from './components/spinner/index.js';

// text-link
// types
export type { ITextLinkProps, ITextLinkVariant } from './components/text-link/index.js';

// components
export { TextLink } from './components/text-link/index.js';

// inline-code
// types
export type { IInlineCodeProps } from './components/inline-code/index.js';

// utilities
export { formatRepositoryPath } from './components/inline-code/index.js';

// components
export { InlineCode } from './components/inline-code/index.js';

// copy-button
// types
export type { ICopyButtonProps } from './components/copy-button/index.js';

// constants
export { COPY_BUTTON_FEEDBACK_DURATION_MS } from './components/copy-button/index.js';

// components
export { CopyButton } from './components/copy-button/index.js';

// form
// types
export type {
  ICheckboxProps,
  IFieldDescriptionProps,
  IFieldErrorProps,
  IFieldGroupProps,
  IFieldLegendProps,
  IFieldProps,
  IFieldSetProps,
  IInputProps,
  ILabelProps,
  IRadioGroupItemProps,
  IRadioGroupProps,
  ISelectContentProps,
  ISelectItemProps,
  ISelectProps,
  ISelectTriggerProps,
  ISelectValueProps,
  ISwitchProps,
  ITextareaProps,
} from './components/form/index.js';

// constants
export { DEFAULT_FORM_PROPS } from './components/form/index.js';

// components
export {
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from './components/form/index.js';

// tabs
// types
export type {
  ITabsActivationMode,
  ITabsContentProps,
  ITabsListProps,
  ITabsOverflowBehavior,
  ITabsProps,
  ITabsTriggerProps,
} from './components/tabs/index.js';

// components
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs/index.js';

// dropdown-menu
// types
export type {
  IDropdownMenuCheckboxItemProps,
  IDropdownMenuContentProps,
  IDropdownMenuGroupProps,
  IDropdownMenuItemProps,
  IDropdownMenuLabelProps,
  IDropdownMenuProps,
  IDropdownMenuRadioGroupProps,
  IDropdownMenuRadioItemProps,
  IDropdownMenuSeparatorProps,
  IDropdownMenuShortcutProps,
  IDropdownMenuSubContentProps,
  IDropdownMenuSubProps,
  IDropdownMenuSubTriggerProps,
  IDropdownMenuTriggerProps,
} from './components/dropdown-menu/index.js';

// components
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/dropdown-menu/index.js';

// tooltip
// types
export type {
  ITooltipContentProps,
  ITooltipProps,
  ITooltipProviderProps,
  ITooltipTriggerProps,
} from './components/tooltip/index.js';

// components
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/tooltip/index.js';

// typography
// types
export type {
  IArticleProps,
  IArticleHeaderProps,
  ISectionProps,
  IParagraphProps,
  ILeadProps,
  ILargeTextProps,
  ISmallTextProps,
  IMutedTextProps,
  IBlockquoteProps,
  IUnorderedListProps,
  IOrderedListProps,
  IListItemProps,
  IKeyboardKeyProps,
  ITableContainerProps,
  ITableProps,
  ITableRowProps,
  ITableHeaderCellProps,
  ITableCellProps,
  IHeadingLevel,
  IHeadingRole,
  IHeadingProps,
} from './components/typography/index.js';

// variants
export { headingVariants } from './components/typography/index.js';

// components
export {
  Article,
  ArticleHeader,
  Section,
  Heading,
  Paragraph,
  Lead,
  LargeText,
  SmallText,
  MutedText,
  Blockquote,
  UnorderedList,
  OrderedList,
  ListItem,
  KeyboardKey,
  TableContainer,
  Table,
  TableRow,
  TableHeaderCell,
  TableCell,
} from './components/typography/index.js';
