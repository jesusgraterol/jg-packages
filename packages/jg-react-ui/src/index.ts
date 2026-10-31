// buttons
export {
  Button,
  buttonVariants,
  type IButtonProps,
  type IButtonBadgeLocation,
  type IButtonBadgeTheme,
} from './components/button/index.js';

// class composition
export { cn } from './cn/index.js';

// preference contracts
export {
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
} from './contracts/index.js';

// badge
export { Badge, badgeVariants, type IBadgeProps } from './components/badge/index.js';

// icon-tile
export {
  IconTile,
  iconTileVariants,
  type IIconTileProps,
  type IIconTileSize,
  type IIconTileTone,
} from './components/icon-tile/index.js';

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
} from './components/alert/index.js';

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

// dialog
// types
export type {
  IDialogBodyProps,
  IDialogCancelProps,
  IDialogCloseProps,
  IDialogContentProps,
  IDialogDescriptionProps,
  IDialogFooterProps,
  IDialogHeaderProps,
  IDialogProps,
  IDialogSize,
  IDialogTitleProps,
  IDialogTriggerProps,
} from './components/dialog/index.js';

// components
export {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/dialog/index.js';

// drawer
// types
export type {
  IDrawerBodyProps,
  IDrawerCloseProps,
  IDrawerContentProps,
  IDrawerDensity,
  IDrawerDescriptionProps,
  IDrawerFooterProps,
  IDrawerHeaderProps,
  IDrawerProps,
  IDrawerSide,
  IDrawerSize,
  IDrawerTitleProps,
  IDrawerTriggerProps,
} from './components/drawer/index.js';

// components
export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './components/drawer/index.js';

// alert-dialog
// types
export type {
  IAlertDialogActionProps,
  IAlertDialogContentProps,
  IAlertDialogDescriptionProps,
  IAlertDialogFooterProps,
  IAlertDialogHeaderProps,
  IAlertDialogProps,
  IAlertDialogTitleProps,
  IAlertDialogTriggerProps,
} from './components/alert-dialog/index.js';

// components
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/alert-dialog/index.js';

// confirmation-dialog
// types
export type {
  IConfirmationDialogCloseHandler,
  IConfirmationDialogStore,
  IOpenConfirmationDialogOptions,
} from './components/confirmation-dialog/index.js';

// components
export { ConfirmationDialog } from './components/confirmation-dialog/index.js';

// stores
export { useConfirmationDialogStore } from './components/confirmation-dialog/index.js';

// dialog-navigation
// shared navigation contracts
export type {
  IDialogNavigationDismissalOptions,
  IDialogNavigationObserverProps,
  IDialogNavigationProviderProps,
  IDialogNavigationSessionReader,
} from './components/dialog-navigation/index.js';

// shared provider, observer, and registration hook
export {
  DialogNavigationObserver,
  DialogNavigationProvider,
  useDialogNavigationDismissal,
} from './components/dialog-navigation/index.js';

// layout
// types
export type {
  IInlineProps,
  IPageDescriptionProps,
  IPageHeaderMetadataProps,
  IPageHeaderProps,
  IPageHeaderRowProps,
  IPageHeaderTitleGroupProps,
  IPageShellProps,
  IPageTitleProps,
  IStackProps,
  ISurfaceProps,
} from './components/layout/index.js';

// constants
export {
  APP_PAGE_CONTENT_HEAVY_LOAD_ANIMATION_CLASS_NAME,
  APP_PAGE_CONTENT_LIGHT_LOAD_ANIMATION_CLASS_NAME,
} from './components/layout/index.js';

// components
export {
  Inline,
  PageDescription,
  PageHeader,
  PageHeaderMetadata,
  PageHeaderRow,
  PageHeaderTitleGroup,
  PageShell,
  PageTitle,
  Stack,
  Surface,
} from './components/layout/index.js';

// global-error-boundary
// types
export type {
  IGlobalErrorBoundaryClassNames,
  IGlobalErrorBoundaryProps,
  IGlobalErrorBoundaryRefreshHandler,
  IGlobalErrorBoundaryViewProps,
} from './components/global-error-boundary/index.js';

// components
export {
  GlobalErrorBoundary,
  GlobalErrorBoundaryView,
} from './components/global-error-boundary/index.js';

// router-root
// components
export { RouterRoot } from './components/router-root/index.js';

// lazy-route-progress
// components
export { LazyRouteProgress } from './components/lazy-route-progress/index.js';

// load-more-button
// types
export type {
  ILoadMoreButtonClassNames,
  ILoadMoreButtonIconPlacement,
  ILoadMoreButtonProps,
  ILoadMoreButtonQuery,
} from './components/load-more-button/index.js';

// constants
export {
  LOAD_MORE_BUTTON_DEFAULT_LABEL,
  LOAD_MORE_BUTTON_DEFAULT_LOADING_LABEL,
} from './components/load-more-button/index.js';

// components
export { LoadMoreButton } from './components/load-more-button/index.js';

// query-boundary
// types
export type {
  IQueryBoundaryErrorAlertProps,
  IQueryBoundaryLoadMoreButtonProps,
  IQueryBoundaryLoaderProps,
  IQueryBoundaryProps,
  IQueryBoundaryQuery,
  IQueryBoundaryRenderErrorAlert,
  IQueryBoundaryRenderLoadMoreButton,
  IQueryBoundaryRenderLoader,
} from './components/query-boundary/index.js';

// components
export { QueryBoundary } from './components/query-boundary/index.js';

// query-error-alert
// types
export type {
  IQueryErrorAlertPresentation,
  IQueryErrorAlertProps,
  IQueryErrorAlertQuery,
  IQueryErrorToastrProps,
} from './components/query-error-alert/index.js';

// components
export { QueryErrorAlert } from './components/query-error-alert/index.js';
export { QueryErrorToastr } from './components/query-error-alert/index.js';

// query-loader
// types
export type {
  IQueryLoaderClassNames,
  IQueryLoaderLayout,
  IQueryLoaderProps,
  IQueryLoaderQuery,
  IQueryLoaderSize,
} from './components/query-loader/index.js';

// components
export { QueryLoader } from './components/query-loader/index.js';

// file-upload
export type {
  IFileUploadPreviewRenderer,
  IFileUploadProps,
  IFileUploadDialogDiscardHandler,
  IFileUploadDialogProps,
  IFileUploadDialogSubmitHandler,
  IImageUploadFieldCurrentImage,
  IImageUploadFieldProps,
} from './components/file-upload/index.js';
export { FileUpload, FileUploadDialog, ImageUploadField } from './components/file-upload/index.js';

// audio-input
export type {
  IAudioInputCancelHandler,
  IAudioInputControls,
  IAudioInputDialogOpenChangeHandler,
  IAudioInputElapsedMsChangeHandler,
  IAudioInputLimitProgress,
  IAudioInputLimitProgressChangeHandler,
  IAudioInputProps,
  IAudioInputRecordedBytesChangeHandler,
  IAudioInputRecording,
  IAudioInputRecordingActiveChangeHandler,
  IAudioInputRecordingCancelHandler,
  IAudioInputRecordingCompleteHandler,
  IAudioInputRecordingDataAvailableHandler,
  IAudioInputRecordingErrorHandler,
  IAudioInputRecordingStartHandler,
  IAudioInputRecordingStopHandler,
  IAudioInputStatusChangeHandler,
  IAudioInputStatus,
  IAudioInputTranscribeHandler,
  IAudioInputTranscriptionCompleteHandler,
  IAudioInputTranscriptionEditorVisibleChangeHandler,
  IAudioInputTranscriptionErrorHandler,
  IAudioInputTranscriptionResultHandler,
  IAudioInputTranscriptionStatus,
  IAudioInputTranscriptionStatusChangeHandler,
  IAudioInputTranscriptionTextChangeHandler,
} from './components/audio-input/index.js';
export {
  AUDIO_INPUT_BYTES_PER_MEGABYTE,
  AUDIO_INPUT_DEFAULT_MAX_BYTES,
  AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
  AudioInput,
} from './components/audio-input/index.js';
