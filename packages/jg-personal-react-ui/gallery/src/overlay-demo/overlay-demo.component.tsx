import { Stack } from 'jg-personal-react-ui';

import { ConfirmationExample } from './confirmation-example/index.js';
import { NavigationDrawer } from './navigation-drawer/index.js';
import { WorkspaceDialog } from './workspace-dialog/index.js';

/** Keeps modal examples private while exercising the published personal entry. */
export const OverlayDemo = () => (
  <section aria-labelledby="overlays-title">
    <h2 id="overlays-title">Dialogs and navigation</h2>
    <p>Compact decisions, full-screen mobile forms, and a side navigation drawer.</p>
    <Stack>
      <WorkspaceDialog size="small" />
      <WorkspaceDialog size="medium" />
      <WorkspaceDialog size="large" />
      <NavigationDrawer />
      <ConfirmationExample />
    </Stack>
  </section>
);
