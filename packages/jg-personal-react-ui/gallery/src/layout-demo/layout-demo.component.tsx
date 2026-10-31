import { Link } from 'react-router';

import {
  APP_PAGE_CONTENT_LIGHT_LOAD_ANIMATION_CLASS_NAME,
  Badge,
  Button,
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
} from 'jg-personal-react-ui';

/** Renders a separate semantic page using the retained layout primitives. */
export const LayoutDemo = () => (
  <PageShell>
    <title>Workspace details | JG UI gallery</title>
    <Stack>
      <Button
        asChild
        size="touch"
        variant="link"
      >
        <Link
          role="link"
          to="/"
        >
          Back to gallery
        </Link>
      </Button>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitleGroup>
            <PageTitle tabIndex={-1}>
              Personal workspace with a long recognizable project title
            </PageTitle>
            <PageHeaderMetadata>
              <Badge>Active</Badge>
            </PageHeaderMetadata>
          </PageHeaderTitleGroup>
          <Button
            size="icon-touch"
            aria-label="Workspace options"
          >
            …
          </Button>
        </PageHeaderRow>
        <PageDescription>
          Your private packages and reusable components share one workspace.
        </PageDescription>
      </PageHeader>
      <Surface
        aria-label="Workspace summary"
        className={APP_PAGE_CONTENT_LIGHT_LOAD_ANIMATION_CLASS_NAME}
      >
        <Stack>
          <h2>Workspace summary</h2>
          <p>Component implementations stay shared while each application supplies its theme.</p>
          <Inline>
            <Badge variant="success">Build passing</Badge>
            <Badge variant="outline">Personal use</Badge>
          </Inline>
        </Stack>
      </Surface>
    </Stack>
  </PageShell>
);
