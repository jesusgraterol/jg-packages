import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { createErrorFeedback, Exception } from 'jg-exception';
import { createPageReturn } from 'jg-react-router';

import markUrl from 'jg-personal-ui/jg-mark.svg';
import {
  Avatar,
  Button,
  ClampedText,
  ErrorFeedbackProvider,
  Illustration,
  InnerPageBar,
  LoadMoreButton,
  Markdown,
  PageShell,
  PathText,
  QueryFailure,
  ResponsiveDialog,
  Stack,
  ViewNav,
  type ILoadMoreButtonQuery,
} from 'jg-personal-react-ui';

// the gallery's way back: only its home page, by its own name
const PAGE_RETURN = createPageReturn({
  resolveOrigin: (url) => (url.pathname === '/' ? { href: '/', label: 'Gallery' } : null),
});

const VIEWS = [
  { value: 'overview', label: 'Overview', to: '?view=overview' },
  { value: 'history', label: 'History', to: '?view=history' },
  { value: 'files', label: 'Changed files', to: '?view=files' },
  { value: 'settings', label: 'Model settings', to: '?view=settings' },
] as const;

const CRITERION =
  'AC-01: The bottom sheet spans the phone, stops short of the notch, closes with a swipe down, returns focus to the control that opened it, and keeps every action reachable by keyboard and by touch, in both themes and with reduced motion.';

const PLAN_MARKDOWN = '# Plan\n\nThe document nests under the page title.\n\n## Steps\n\nOne step.';

// a read that failed with a code long enough to overflow a phone unless the alert lets it shrink
const FAILED_READ = {
  isError: true,
  error: new Exception('The provider catalog could not be read', {
    code: 'GALLERY_PROVIDER_CATALOG_UNREADABLE_BECAUSE_THE_COMMAND_LINE_TOOL_IS_MISSING',
  }),
  refetch: () => Promise.resolve(undefined),
};

// the policy that shows the gallery's provider codes beside the fallback, for support requests
const APP_ERROR_POLICY = createErrorFeedback({
  fallbackMessage: 'The provider catalog could not be read. Try again.',
  publicCodePattern: /^GALLERY_PROVIDER_/u,
});

// the events a long list loads page by page
const PAGE_SIZE = 8;
const PAGE_COUNT = 3;
const PAGE_LATENCY_MS = 50;

/** Renders an inner page that composes the app-level components with real styles. */
export const AppDemo = () => {
  const [searchParams] = useSearchParams();
  const view = VIEWS.find((item) => item.value === searchParams.get('view'))?.value ?? 'overview';
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [pages, setPages] = useState(1);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  // a page arrives a moment after it's asked for, as one read from a server does
  const fetchNextPage = useCallback(async () => {
    setIsFetchingNextPage(true);
    await new Promise((resolve) => {
      setTimeout(resolve, PAGE_LATENCY_MS);
    });
    setPages((current) => Math.min(PAGE_COUNT, current + 1));
    setIsFetchingNextPage(false);
  }, []);
  const eventsQuery = useMemo<ILoadMoreButtonQuery>(
    () => ({
      isError: false,
      hasNextPage: pages < PAGE_COUNT,
      isFetchingNextPage,
      fetchNextPage,
    }),
    [fetchNextPage, isFetchingNextPage, pages],
  );

  return (
    <PageShell>
      <title>Session details | JG UI gallery</title>
      <InnerPageBar
        actions={
          <Button
            size="touch"
            type="button"
            variant="outline"
            onClick={() => {
              setIsDetailsOpen(true);
            }}
          >
            Details
          </Button>
        }
        pageReturn={PAGE_RETURN}
        parentHref="/"
        parentLabel="Gallery"
        title="A session with a long title that the bar cuts to fit on a phone"
      />
      <Stack>
        <h1 className="text-2xl font-semibold">App patterns</h1>
        <ViewNav
          preventScrollReset
          replace
          current={view}
          items={VIEWS}
          label="Session views"
        />
        <section aria-labelledby="people-title">
          <h2 id="people-title">Avatars</h2>
          <div className="flex items-center gap-3">
            <Avatar
              alt="JG mark"
              fallback="JG"
              size="xl"
              src={markUrl}
            />
            <Avatar
              alt="Ada Lovelace"
              fallback="Ada"
              size="xl"
              src="/missing-avatar.png"
            />
            <Avatar
              alt=""
              fallback="?"
              size="xl"
              src={null}
            />
          </div>
        </section>
        <section aria-labelledby="text-title">
          <h2 id="text-title">Long text</h2>
          <p className="font-mono text-sm">
            <PathText path="/home/jesusgraterol/Documents/projects/personal/jg-agent-hq-jesus--1793757747-simplify/app/src" />
          </p>
          <ClampedText
            className="text-xs font-medium"
            details={<span className="text-muted">Milestones 1, 2</span>}
            textClassName="text-sm font-normal leading-relaxed"
          >
            {CRITERION.repeat(2)}
          </ClampedText>
          <Markdown headingLevelOffset={1}>{PLAN_MARKDOWN}</Markdown>
        </section>
        <section aria-labelledby="states-title">
          <h2 id="states-title">Empty and failed states</h2>
          <div className="flex flex-wrap gap-3">
            <Illustration name="list" />
            <Illustration name="conversation" />
            <Illustration name="checklist" />
            <Illustration name="error" />
            <Illustration name="offline" />
          </div>
          <ErrorFeedbackProvider resolveErrorFeedback={APP_ERROR_POLICY}>
            <QueryFailure
              presentation="blocking"
              queries={[FAILED_READ]}
            />
          </ErrorFeedbackProvider>
        </section>
        <section aria-labelledby="events-title">
          <h2 id="events-title">Events</h2>
          <ol aria-label="Events">
            {Array.from({ length: pages * PAGE_SIZE }, (_, index) => (
              <li
                key={index}
                className="border-b py-3"
              >
                Event {index + 1}
              </li>
            ))}
          </ol>
          <LoadMoreButton
            autoLoad
            query={eventsQuery}
          />
        </section>
      </Stack>
      <ResponsiveDialog
        isOverlayCloseEnabled
        description="Where the session runs"
        open={isDetailsOpen}
        title="Session details"
        onOpenChange={setIsDetailsOpen}
      >
        {searchParams.get('details') === 'long' ? (
          <ul aria-label="Session destinations">
            {Array.from({ length: 64 }, (_, index) => (
              <li key={index}>
                <Button
                  size="touch"
                  type="button"
                  variant="ghost"
                >
                  Session {index + 1}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Started an hour ago in jg-agent-hq.</p>
        )}
      </ResponsiveDialog>
    </PageShell>
  );
};
