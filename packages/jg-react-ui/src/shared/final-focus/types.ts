import type { Menu as BaseMenu } from '@base-ui/react/menu';

// Base UI popup focus behavior shared by menu and select content.
export type IFinalFocus = BaseMenu.Popup.Props['finalFocus'];

// callback notified before the popup restores focus.
export type ICloseAutoFocusHandler = (event: Event) => void;
