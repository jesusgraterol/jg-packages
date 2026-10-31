# jg-react-ui recipes

App-side composition with the public surface.

## Use the public entry

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

## Style a navigation action

Use an explicit link role when the slotted child navigates.

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const settingsLink = createElement(
  Button,
  { asChild: true, variant: 'link', size: 'touch' },
  createElement('a', { href: '/settings', role: 'link' }, 'Settings'),
);
```

## Compose notices and status labels

Slot native elements when an entire notice is interactive. Keep supplementary actions on static alerts.

```ts
import { createElement } from 'react';
import { Alert, AlertTitle, AlertDescription, Badge, IconTile } from 'jg-react-ui';
const notice = createElement(
  Alert,
  { asChild: true, interaction: 'redirect' },
  createElement(
    'a',
    { href: '/activity' },
    createElement(AlertTitle, null, 'Review activity'),
    createElement(AlertDescription, null, 'Your latest updates are ready.'),
  ),
);
const status = createElement(Badge, { variant: 'success' }, 'Saved');
const step = createElement(IconTile, { tone: 'brand', 'aria-hidden': false }, '1');
```

## Scope application error feedback

Applications own their error messages and decide which codes mean that access was lost. Keep the resolver outside render so its identity remains stable.

```ts
import { createElement } from 'react';
import { createErrorFeedback } from 'jg-exception';
import { ErrorFeedbackProvider } from 'jg-react-ui/components/error-feedback-provider';
const resolveErrorFeedback = createErrorFeedback({
  fallbackMessage: 'We could not complete this action. Please try again.',
  messagesByCode: { SESSION_EXPIRED: 'Please sign in again.' },
  accessDeniedCodes: ['SESSION_EXPIRED'],
});
const app = createElement(ErrorFeedbackProvider, { resolveErrorFeedback, children: 'App' });
```

## Compose preferences, theme, and notifications

Place the initialization element in the document head. Keep the same namespace on the provider. A local tree needs no server adapter; use `mode: 'remote'` with complete authoritative preferences and a rejecting `persistPreferences` promise when the application saves settings remotely.

```ts
import { createElement } from 'react';
import {
  ThemeInitializationScript,
  ThemeProvider,
  ThemeToggleButton,
  Toastr,
  UiPreferencesProvider,
} from 'jg-react-ui';
const storageId = 'personal-hq';
const head = createElement(ThemeInitializationScript, { storageId, nonce: 'example-nonce' });
const app = createElement(UiPreferencesProvider, {
  mode: 'local',
  storageId,
  children: createElement(ThemeProvider, {
    children: [
      createElement(ThemeToggleButton, { key: 'theme', size: 'icon-touch' }),
      createElement(Toastr, { key: 'toasts', closeButton: true }),
    ],
  }),
});
```

Read `useUiPreferences()` for the snapshot, update function, capability, and pending state. Use `useUiPreferencesCapabilities()` when only capability or the stable update callback is needed. `useTheme()` requires a ThemeProvider and returns the selected theme, resolved light/dark theme, and setter. Changing a captured namespace requires a keyed provider remount.

## Compose fields and choice controls

The application owns validation. Associate labels, descriptions, and errors explicitly. Keep compact checkbox, radio, and switch glyphs inside labelled rows with at least a 44px touch target.

```ts
import { createElement } from 'react';
import { Checkbox, Field, FieldDescription, Input, Label } from 'jg-react-ui/components/form';
const field = createElement(
  Field,
  null,
  createElement(Label, { htmlFor: 'workspace-name' }, 'Workspace name'),
  createElement(Input, {
    id: 'workspace-name',
    name: 'workspace',
    required: true,
    'aria-describedby': 'workspace-help',
  }),
  createElement(FieldDescription, { id: 'workspace-help' }, 'Choose a recognizable name.'),
);
const choice = createElement(
  Label,
  { htmlFor: 'keep-history', className: 'flex min-h-11 items-center gap-3' },
  createElement(Checkbox, { id: 'keep-history', defaultChecked: true }),
  'Keep session history',
);
```

## Choose tab overflow and cancel a menu command

Choose `scroll` for complete long labels, or `truncate` for constrained labels. Composite truncated labels require an authored `title` or `aria-label`. Manual activation moves focus with arrow keys and selects on Enter or Space. A menu item's cancelable `onSelect` event can keep its menu open.

```ts
import { createElement } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'jg-react-ui';
const tabs = createElement(
  Tabs,
  { defaultValue: 'overview', activationMode: 'manual' },
  createElement(
    TabsList,
    { overflowBehavior: 'scroll', 'aria-label': 'Workspace views' },
    createElement(TabsTrigger, { value: 'overview' }, 'Workspace overview'),
    createElement(TabsTrigger, { value: 'history' }, 'Recent session history'),
  ),
  createElement(TabsContent, { value: 'overview' }, 'Overview'),
  createElement(TabsContent, { value: 'history' }, 'History'),
);
const menu = createElement(
  DropdownMenu,
  null,
  createElement(DropdownMenuTrigger, null, 'Commands'),
  createElement(
    DropdownMenuContent,
    null,
    createElement(
      DropdownMenuItem,
      { onSelect: (event) => event.preventDefault() },
      'Keep menu open',
    ),
  ),
);
```

## Copy exact text and keep technical content readable

`copyLabel` describes the ready operation; `label` adds visible text. Copied feedback starts only after the native write fulfills. Cancellation is silent, and failures use the scoped error policy with manual-copy guidance. `copiedFeedbackDuration` retains Moldea's milliseconds contract. New-tab TextLinks retain secure rel tokens and an accessible destination notice.

```ts
import { createElement } from 'react';
import { CopyButton, InlineCode, TextLink, TableContainer } from 'jg-react-ui';
const copy = createElement(CopyButton, {
  value: 'pnpm build',
  copyLabel: 'Copy build command',
  label: 'Copy command',
  size: 'touch',
});
const path = createElement(InlineCode, null, '/workspace/config/preferences.ts');
const guide = createElement(
  TextLink,
  { href: 'https://example.com/guide', target: '_blank' },
  'Workspace guide',
);
const tableRegion = createElement(
  TableContainer,
  {
    role: 'region',
    'aria-label': 'Workspace settings',
    tabIndex: 0,
    className: 'outline-none focus-visible:ring-2 focus-visible:ring-foreground',
  },
  'Table content',
);
```

## Compose a responsive dialog

Keep the header, scrolling body, and optional footer as direct regions. An asChild panel uses a role-compatible element such as a div. Put a form inside the body and give fixed submit buttons its form ID. Small dialogs use their header close control instead of DialogCancel; medium and large dialogs expose mobile Back and desktop cancellation.

```ts
import { createElement as h } from 'react';
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogCancel,
  DialogClose,
} from 'jg-react-ui';
const dialog = h(
  Dialog,
  null,
  h(DialogTrigger, { asChild: true }, h(Button, { size: 'touch' }, 'Edit workspace')),
  h(
    DialogContent,
    { size: 'medium' },
    h(
      DialogHeader,
      null,
      h(DialogTitle, null, 'Workspace settings'),
      h(DialogDescription, null, 'Review your changes.'),
    ),
    h(
      DialogBody,
      null,
      h('input', { 'aria-label': 'Workspace name', defaultValue: 'Personal workspace' }),
    ),
    h(
      DialogFooter,
      null,
      h(
        DialogCancel,
        { asChild: true },
        h(Button, { size: 'touch', variant: 'outline' }, 'Cancel'),
      ),
      h(DialogClose, { asChild: true }, h(Button, { size: 'touch' }, 'Done')),
    ),
  ),
);
```

## Share route dismissal and confirmation sessions

The navigation primitives share jg-react-router's context. Place one observer inside the router, and keep persistent dialog hosts under the same provider. Committed navigation cancels outgoing sessions without adding history entries. The host owns route history and drawer dismissal; compose DrawerClose around a navigation action when it should close the drawer.

```ts
import { createElement as h, Fragment } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import {
  ConfirmationDialog,
  DialogNavigationObserver,
  DialogNavigationProvider,
  useConfirmationDialogStore,
} from 'jg-react-ui';
const router = createBrowserRouter([
  {
    path: '/',
    element: h(Fragment, null, h(DialogNavigationObserver), h('main', null, 'Workspace')),
  },
]);
const app = h(DialogNavigationProvider, null, h(RouterProvider, { router }), h(ConfirmationDialog));
const requestConfirmation = (onDecision: (isConfirmed: true | undefined) => void) =>
  useConfirmationDialogStore.getState().openConfirmationDialog({
    title: 'Archive workspace?',
    description: 'You can restore it from the archive.',
    confirmText: 'Archive',
    onConfirmationDialogClose: onDecision,
  });
```

Mount one ConfirmationDialog per document. Its store is imperative and document-wide, so do not mutate it while rendering on the server. Completion resets before invoking the application callback, which owns its async work and errors.

## Keep query state and error policy in the application

Use one application query client and scope authored copy outside the routes that may fail. Install the query peers at compatible tested versions. A generic unknown error stays private; only the application decides which codes mean lost access.

```ts
import { createElement } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createErrorFeedback } from 'jg-exception';
import { ErrorFeedbackProvider, QueryBoundary } from 'jg-react-ui';

declare const readRecords: () => Promise<string>;
const client = new QueryClient();
const policy = createErrorFeedback({
  fallbackMessage: 'Records could not be loaded. Try again.',
  messagesByCode: { ACCESS_REVOKED: 'Access to these records was revoked.' },
  accessDeniedCodes: ['ACCESS_REVOKED'],
});
const Records = () => {
  const query = useQuery({ queryKey: ['records'], queryFn: readRecords });
  return createElement(QueryBoundary, { queries: [query], resolutionKey: 'records' }, query.data);
};
const example = createElement(ErrorFeedbackProvider, {
  resolveErrorFeedback: policy,
  children: createElement(QueryClientProvider, { client }, createElement(Records)),
});
```

For retained failures, a custom `renderErrorAlert` can return `QueryErrorToastr` with a stable unique `toastId`. Keep inline feedback for blocking failures and one document notification host. `isInitialResolutionApproved` is trusted prior resolution, and cannot override a confirmed access loss. Update `resolutionKey` whenever the logical record identity changes.

## Compose data-router recovery

`RouterRoot` keeps the source outlet behavior. Place providers outside `RouterProvider` so error routes retain their context. Add `PageOutlet` from `jg-react-router` and its explicit stylesheet when the host owns focus and Back/Forward scroll restoration.

```ts
import { createElement } from 'react';
import { createBrowserRouter } from 'react-router';
import { GlobalErrorBoundary, RouterRoot } from 'jg-react-ui';
const router = createBrowserRouter([
  {
    element: createElement(RouterRoot),
    errorElement: createElement(GlobalErrorBoundary),
    children: [{ path: '/', element: 'Home' }],
  },
]);
```

## Supply upload and dictation adapters

The application owns remote requests, authentication, deadlines, and cleanup. Upload progress is in bytes, and cancellation must reach the transport through its signal. The dialog finalizes already-uploaded results and reports abandoned successful items for application cleanup.

```ts
import { createElement } from 'react';
import {
  AudioInput,
  FileUpload,
  FileUploadDialog,
  type IAudioInputTranscribeHandler,
  type IAudioInputTranscriptionResultHandler,
  type IFileUploadProps,
  type IFileUploadDialogDiscardHandler,
  type IFileUploadDialogSubmitHandler,
} from 'jg-react-ui';

declare const uploadFile: IFileUploadProps<{ id: string }>['uploadFile'];
declare const finalize: IFileUploadDialogSubmitHandler<{ id: string }>;
declare const discard: IFileUploadDialogDiscardHandler<{ id: string }>;
declare const transcribe: IAudioInputTranscribeHandler;
declare const send: IAudioInputTranscriptionResultHandler;
const policy = { acceptedFileTypes: ['text/plain'], maxFileBytes: 4096, maxFiles: 4, uploadFile };
const upload = createElement(FileUpload<{ id: string }>, policy);
const dialog = createElement(FileUploadDialog<{ id: string }>, {
  fileUploadProps: policy,
  onSubmit: finalize,
  onDiscard: discard,
});
const voiceNote = createElement(AudioInput, { transcribe, onTranscriptionResult: send });
```

Scope an ErrorFeedbackProvider around these components for reviewed provider messages. Diagnostic error callbacks retain the original cause; visible UI uses that scoped policy. A failed send retries the current text without calling the transcription provider again. Keep provider requests bounded and cancel them when their application owner leaves. The recorder releases its own microphone, waveform, timer, and callback resources. For ImageUploadField, the caller owns currentImage and any object URL lifetime.
