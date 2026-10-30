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
