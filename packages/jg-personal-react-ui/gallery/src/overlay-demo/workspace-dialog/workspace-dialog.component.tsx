import { useState } from 'react';
import { Link } from 'react-router';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Stack,
  type IDialogSize,
} from 'jg-personal-react-ui';

import { SESSION_HISTORY } from '../session-history/index.js';

/** Exercises the retained dialog API with real fields, nested decisions, and busy dismissal. */
export const WorkspaceDialog = ({ size }: { size: IDialogSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState('No changes yet');
  const title = `${size} workspace`;
  return (
    <div>
      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
        isDismissalDisabled={isBusy}
      >
        <DialogTrigger asChild>
          <Button size="touch">Open {title}</Button>
        </DialogTrigger>
        <DialogContent
          asChild
          size={size}
        >
          <div>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Review the workspace before saving your changes.
              </DialogDescription>
            </DialogHeader>
            <DialogBody
              role="region"
              aria-label={`${size} workspace fields`}
              tabIndex={0}
              className="focus-visible:outline-foreground focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <form
                id={`${size}-workspace-form`}
                onSubmit={(event) => {
                  event.preventDefault();
                  setResult('Workspace saved');
                  setIsOpen(false);
                }}
              >
                <Stack>
                  <div>
                    <Label htmlFor={`${size}-workspace-name`}>Workspace name</Label>
                    <Input
                      id={`${size}-workspace-name`}
                      defaultValue="Personal workspace"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={() => setIsBusy((current) => !current)}
                  >
                    {isBusy ? 'Finish pending save' : 'Simulate pending save'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="touch"
                        variant="outline"
                      >
                        Review archive decision
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive this workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The workspace stays available in your archive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogAction
                          size="touch"
                          onClick={() => setResult('Workspace archived')}
                        >
                          Archive workspace
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    asChild
                    variant="link"
                    size="touch"
                  >
                    <Link
                      role="link"
                      to="/layout"
                    >
                      Navigate to workspace details
                    </Link>
                  </Button>
                  <ol className="grid gap-3">
                    {SESSION_HISTORY.map((session) => (
                      <li key={session.id}>{session.text}</li>
                    ))}
                  </ol>
                  <div>
                    <Label htmlFor={`${size}-workspace-note`}>Final note</Label>
                    <Input
                      id={`${size}-workspace-note`}
                      placeholder="Ready to save"
                    />
                  </div>
                </Stack>
              </form>
            </DialogBody>
            <DialogFooter>
              <DialogCancel asChild>
                <Button
                  type="button"
                  size="touch"
                  variant="outline"
                >
                  Cancel
                </Button>
              </DialogCancel>
              <Button
                type="submit"
                form={`${size}-workspace-form`}
                size="touch"
                disabled={isBusy}
              >
                Save workspace changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <p
        role="status"
        aria-label={`${size} workspace result`}
      >
        {result}
      </p>
    </div>
  );
};
