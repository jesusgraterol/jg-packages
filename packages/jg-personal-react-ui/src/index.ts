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
