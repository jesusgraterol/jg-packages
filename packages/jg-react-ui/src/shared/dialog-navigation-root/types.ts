import type { Dialog as BaseDialog } from '@base-ui/react/dialog';

import type { IDialogNavigationSessionReader } from '../../components/dialog-navigation/index.js';

// shared primitive lifecycle inputs preserve the supported Base UI action contract
export type IDialogNavigationRootOptions = Pick<
  BaseDialog.Root.Props,
  'actionsRef' | 'defaultOpen' | 'handle' | 'open'
> & {
  getNavigationSession?: IDialogNavigationSessionReader | undefined;
};
