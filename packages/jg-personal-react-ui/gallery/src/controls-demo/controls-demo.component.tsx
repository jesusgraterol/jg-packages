import { useState } from 'react';

import {
  Button,
  Checkbox,
  CopyButton,
  Divider,
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
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TextLink,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'jg-personal-react-ui';

/** Renders the control contracts with native form composition and consumer-owned state. */
export const ControlsDemo = () => {
  const [name, setName] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [selection, setSelection] = useState('Local workspace');
  const [menuAction, setMenuAction] = useState('No command selected');
  const [autoSave, setAutoSave] = useState(true);
  const hasNameError = hasSubmitted && !name.trim();
  return (
    <section aria-labelledby="controls-title">
      <h2 id="controls-title">Controls and composition</h2>
      <p>Native fields, keyboard navigation, and compact application controls.</p>
      <div className="grid min-w-0 gap-8 md:grid-cols-2">
        <form
          noValidate
          aria-label="Workspace settings"
          onSubmit={(event) => {
            event.preventDefault();
            setHasSubmitted(true);
            if (name.trim()) setSavedName(name.trim());
          }}
        >
          <FieldSet>
            <FieldLegend>Workspace settings</FieldLegend>
            <FieldGroup>
              <Field>
                <Label htmlFor="project-name">Workspace name</Label>
                <Input
                  id="project-name"
                  name="workspace"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={hasNameError}
                  aria-describedby={hasNameError ? 'project-help project-error' : 'project-help'}
                />
                <FieldDescription id="project-help">
                  A name you can recognize in the workspace list.
                </FieldDescription>
                {hasNameError && (
                  <FieldError id="project-error">Enter a workspace name.</FieldError>
                )}
              </Field>
              <Field>
                <Label htmlFor="project-notes">Workspace notes</Label>
                <Textarea
                  id="project-notes"
                  name="notes"
                  placeholder="What are you working on?"
                />
              </Field>
              <Field>
                <Label
                  id="storage-label"
                  htmlFor="storage-location"
                >
                  Storage location
                </Label>
                <Select
                  defaultValue="local"
                  onValueChange={(next) =>
                    setSelection(next === 'local' ? 'Local workspace' : 'Shared workspace')
                  }
                >
                  <SelectTrigger
                    id="storage-location"
                    aria-labelledby="storage-label"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local workspace</SelectItem>
                    <SelectItem value="shared">Shared workspace</SelectItem>
                    <SelectItem
                      value="unavailable"
                      disabled
                    >
                      Unavailable workspace
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>{selection}</FieldDescription>
              </Field>
              <Label
                className="flex min-h-11 cursor-pointer items-center gap-3"
                htmlFor="keep-history"
              >
                <Checkbox
                  id="keep-history"
                  defaultChecked="indeterminate"
                />
                Keep session history
              </Label>
              <RadioGroup
                defaultValue="daily"
                aria-label="Sync frequency"
              >
                <Label
                  className="flex min-h-11 cursor-pointer items-center gap-3"
                  htmlFor="sync-daily"
                >
                  <RadioGroupItem
                    id="sync-daily"
                    value="daily"
                  />
                  Daily sync
                </Label>
                <Label
                  className="flex min-h-11 cursor-pointer items-center gap-3"
                  htmlFor="sync-weekly"
                >
                  <RadioGroupItem
                    id="sync-weekly"
                    value="weekly"
                  />
                  Weekly sync
                </Label>
              </RadioGroup>
              <Label
                className="flex min-h-11 cursor-pointer items-center gap-3"
                htmlFor="background-sync"
              >
                <Switch
                  id="background-sync"
                  defaultChecked
                />
                Background sync
              </Label>
              <Field>
                <Label htmlFor="locked-field">Managed setting</Label>
                <Input
                  id="locked-field"
                  value="Managed by your workspace"
                  disabled
                />
              </Field>
              <Button
                type="submit"
                size="touch"
              >
                Save workspace
              </Button>
              <p
                role="status"
                aria-label="Workspace save result"
              >
                {savedName ? `Saved ${savedName}` : 'No workspace changes saved.'}
              </p>
            </FieldGroup>
          </FieldSet>
        </form>
        <div className="grid min-w-0 content-start gap-6">
          <Tabs defaultValue="overview">
            <TabsList
              overflowBehavior="scroll"
              aria-label="Workspace views"
            >
              <TabsTrigger value="overview">Workspace overview</TabsTrigger>
              <TabsTrigger value="sessions">Recent session history</TabsTrigger>
              <TabsTrigger
                value="settings"
                disabled
              >
                Advanced settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p>Keyboard arrows move between available views.</p>
              <div className="mt-4 grid gap-3">
                <Label htmlFor="sync-progress">Sync progress</Label>
                <Progress
                  id="sync-progress"
                  value={42}
                  aria-label="Sync progress"
                />
                <Progress
                  indeterminate
                  aria-label="Connecting to workspace"
                />
                <div className="flex items-center gap-2">
                  <Spinner aria-label="Loading workspace" />
                  <span>Loading workspace</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="sessions">
              <EmptyState>
                <EmptyStateTitle>No sessions yet</EmptyStateTitle>
                <EmptyStateDescription>Start a session to see it here.</EmptyStateDescription>
                <Button
                  size="touch"
                  onClick={() => setMenuAction('Session started')}
                >
                  Start session
                </Button>
              </EmptyState>
            </TabsContent>
          </Tabs>
          <Divider />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="touch">Workspace commands</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setMenuAction('Workspace opened')}>
                  Open workspace<DropdownMenuShortcut>↵</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                  closeOnClick={false}
                >
                  Auto save
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup defaultValue="comfortable">
                <DropdownMenuRadioItem value="compact">Compact density</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">
                  Comfortable density
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Export workspace</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setMenuAction('CSV exported')}>
                    Export CSV
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setMenuAction('Command cancelled');
                }}
              >
                Keep menu open
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Unavailable command for workspace_configuration_preferences_and_background_sync
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p
            role="status"
            aria-label="Workspace command result"
          >
            {menuAction}
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="touch"
                  variant="secondary"
                  onClick={() => setMenuAction('Preview refreshed')}
                >
                  Refresh preview
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh workspace preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <CopyButton
            value="pnpm build"
            label="Copy command"
            copiedLabel="Command copied"
            copyLabel="Copy build command"
            size="touch"
          />
          <TextLink
            href="https://example.com/guide"
            target="_blank"
          >
            Workspace guide
          </TextLink>
        </div>
      </div>
    </section>
  );
};
