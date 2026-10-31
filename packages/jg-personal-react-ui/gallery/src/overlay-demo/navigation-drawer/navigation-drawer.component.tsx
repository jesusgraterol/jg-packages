import { Link } from 'react-router';

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Stack,
} from 'jg-personal-react-ui';

import { SESSION_HISTORY } from '../session-history/index.js';

/** Shows the source drawer composition with an explicit route-dismissal control. */
export const NavigationDrawer = () => (
  <Drawer side="right">
    <DrawerTrigger asChild>
      <Button
        size="touch"
        variant="outline"
      >
        Open navigation drawer
      </Button>
    </DrawerTrigger>
    <DrawerContent size="medium">
      <DrawerHeader>
        <DrawerTitle>Workspace navigation</DrawerTitle>
        <DrawerDescription>Current projects and recent sessions.</DrawerDescription>
      </DrawerHeader>
      <DrawerBody
        role="region"
        aria-label="Workspace navigation links"
        tabIndex={0}
      >
        <Stack>
          <DrawerClose asChild>
            <Button
              asChild
              size="touch"
              variant="link"
            >
              <Link
                role="link"
                to="/layout"
              >
                Workspace details
              </Link>
            </Button>
          </DrawerClose>
          {SESSION_HISTORY.map((session) => (
            <p key={session.id}>{session.text}</p>
          ))}
        </Stack>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose asChild>
          <Button
            size="touch"
            variant="outline"
          >
            Return to gallery
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
