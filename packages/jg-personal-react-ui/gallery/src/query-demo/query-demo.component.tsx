import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  PageDescription,
  PageHeader,
  PageShell,
  PageTitle,
  QueryBoundary,
  QueryErrorAlert,
  QueryErrorToastr,
  type IQueryErrorAlertProps,
} from 'jg-personal-react-ui';

import { readGalleryRecord } from './utilities.js';

/** Uses a toast for retained failures and the inline recovery surface for blocked content. */
const renderError = (props: IQueryErrorAlertProps) =>
  props.presentation === 'retained' ? (
    <QueryErrorToastr
      queries={props.queries}
      toastId="gallery-records"
    />
  ) : (
    <QueryErrorAlert {...props} />
  );

/** Exercises published query UI against an actual browser request and a bounded four-page fixture. */
export const QueryDemo = () => {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['gallery-records'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => readGalleryRecord(pageParam, signal),
    getNextPageParam: (_last, pages) => (pages.length < 4 ? pages.length + 1 : undefined),
    staleTime: 0,
  });
  return (
    <PageShell className="min-h-svh">
      <PageHeader>
        <PageTitle>Query recovery</PageTitle>
        <PageDescription>Initial loading, retained records, and access recovery.</PageDescription>
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <Button
          size="touch"
          asChild
        >
          <Link
            role="link"
            to="/"
          >
            Back to gallery
          </Link>
        </Button>
        <Button
          size="touch"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Refresh records
        </Button>
        <Button
          size="touch"
          variant="outline"
          onClick={() => void client.cancelQueries({ queryKey: ['gallery-records'] })}
        >
          Cancel read
        </Button>
        <Button
          size="touch"
          variant="outline"
          asChild
        >
          <Link
            role="link"
            to="/queries/next"
          >
            Next screen
          </Link>
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="touch">Open query dialog</Button>
          </DialogTrigger>
          <DialogContent size="small">
            <DialogHeader>
              <DialogTitle>Query draft</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p>This session closes when the destination commits.</p>
              <Button
                size="touch"
                asChild
              >
                <Link
                  role="link"
                  to="/queries/next"
                >
                  Continue to next screen
                </Link>
              </Button>
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>
      <QueryBoundary
        queries={[query]}
        resolutionKey="gallery-records"
        renderErrorAlert={renderError}
      >
        <section
          aria-label="Current records"
          className="mt-6 grid min-w-0 gap-4"
        >
          {query.data?.pages.map((record, index) => (
            <article
              className="min-w-0 wrap-anywhere rounded-md border border-border p-4"
              key={index}
            >
              <h2>Record {index + 1}</h2>
              <p>{record}</p>
            </article>
          ))}
        </section>
      </QueryBoundary>
      <div className="mt-6">
        <Button
          size="touch"
          variant="outline"
          asChild
        >
          <Link
            role="link"
            to="/queries/next"
          >
            Continue after records
          </Link>
        </Button>
      </div>
    </PageShell>
  );
};
