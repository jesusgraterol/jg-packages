import {
  type ReactElement,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { updateApp } from 'jg-sw';
import { cn } from 'cnfast';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Button } from '../button/index.js';
import { DialogNavigationObserver } from '../dialog-navigation/index.js';
import { Spinner } from '../spinner/index.js';
import type { IGlobalErrorBoundaryProps, IGlobalErrorBoundaryViewProps } from './types.js';

// default status copy identifies the route-level boundary state.
const GLOBAL_ERROR_BOUNDARY_DEFAULT_STATUS_LABEL = 'Application error';

// default heading keeps the global failure clear without exposing implementation details.
const GLOBAL_ERROR_BOUNDARY_DEFAULT_HEADING = 'Something went wrong';

// default description explains the recovery path without diagnostic details.
const GLOBAL_ERROR_BOUNDARY_DEFAULT_DESCRIPTION = 'The app ran into an unexpected issue.';

// fallback shown when an error object does not expose a stable code.
const GLOBAL_ERROR_BOUNDARY_UNKNOWN_ERROR_CODE_LABEL = 'Unknown';

// refresh button copy used while the action is idle.
const GLOBAL_ERROR_BOUNDARY_DEFAULT_REFRESH_BUTTON_LABEL = 'Refresh app';

// refresh button copy used while jg-sw is updating the app.
const GLOBAL_ERROR_BOUNDARY_DEFAULT_REFRESHING_BUTTON_LABEL = 'Refreshing app';

/**
 * Renders the full-screen global error fallback from an explicit error value.
 * @param props The thrown error, optional copy, refresh handler, and root attributes.
 * @returns A React element that renders the global error recovery screen.
 * @example
 * import { createElement } from 'react';
 * import { GlobalErrorBoundaryView } from 'jg-react-ui/components/global-error-boundary';
 * const example = createElement(GlobalErrorBoundaryView, { error: new Error('Private diagnostics'), onRefreshClick: async () => undefined });
 */
export const GlobalErrorBoundaryView = ({
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  className,
  classNames,
  description = GLOBAL_ERROR_BOUNDARY_DEFAULT_DESCRIPTION,
  error,
  heading = GLOBAL_ERROR_BOUNDARY_DEFAULT_HEADING,
  onRefreshClick = updateApp,
  refreshButtonLabel = GLOBAL_ERROR_BOUNDARY_DEFAULT_REFRESH_BUTTON_LABEL,
  refreshingButtonLabel = GLOBAL_ERROR_BOUNDARY_DEFAULT_REFRESHING_BUTTON_LABEL,
  statusLabel = GLOBAL_ERROR_BOUNDARY_DEFAULT_STATUS_LABEL,
  ...props
}: IGlobalErrorBoundaryViewProps): ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const headingId = useId();
  const descriptionId = useId();
  const feedback = useMemo(() => resolveErrorFeedback(error), [error, resolveErrorFeedback]);
  const isRefreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshErrorMessage, setRefreshErrorMessage] = useState<string | null>(null);
  const displayedErrorCode = feedback.code ?? GLOBAL_ERROR_BOUNDARY_UNKNOWN_ERROR_CODE_LABEL;
  const resolvedRefreshButtonLabel = isRefreshing ? refreshingButtonLabel : refreshButtonLabel;

  /**
   * Requests an app refresh through the configured refresh handler.
   * @returns A promise that resolves after the refresh request has completed.
   */
  const handleRefreshClick = useCallback(async (): Promise<void> => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshErrorMessage(null);

    try {
      await onRefreshClick();
    } catch (refreshError) {
      setRefreshErrorMessage(
        resolveErrorFeedback(refreshError, {
          fallbackMessage: 'We could not refresh the app. Please try again.',
        }).message,
      );
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [onRefreshClick, resolveErrorFeedback]);

  return (
    <main
      data-slot="global-error-boundary"
      aria-describedby={ariaDescribedBy ?? descriptionId}
      aria-labelledby={ariaLabelledBy ?? headingId}
      className={cn(
        'inverse-surface-selection bg-primary text-primary-foreground px-page-gutter pl-[max(var(--spacing-page-gutter),env(safe-area-inset-left))] pr-[max(var(--spacing-page-gutter),env(safe-area-inset-right))] grid min-h-svh py-[max(2.5rem,env(safe-area-inset-top),env(safe-area-inset-bottom))]',
        className,
        classNames?.root,
      )}
      {...props}
    >
      <section
        data-slot="global-error-boundary-content"
        role="alert"
        aria-live="assertive"
        className={cn(
          'mx-auto grid w-full max-w-2xl min-w-0 justify-items-center gap-6 place-self-center text-center',
          classNames?.content,
        )}
      >
        <div
          data-slot="global-error-boundary-status"
          className={cn(
            'border-primary-foreground/20 bg-primary-foreground/10 inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs leading-5 font-semibold tracking-normal break-words backdrop-blur',
            classNames?.status,
          )}
        >
          <TriangleAlert
            aria-hidden="true"
            className="text-primary-foreground size-3.5 shrink-0"
          />
          <span className="min-w-0 break-all">{statusLabel}</span>
        </div>

        <div className="grid w-full min-w-0 gap-3">
          <h1
            id={headingId}
            data-slot="global-error-boundary-heading"
            className={cn(
              'min-w-0 text-4xl leading-tight font-extrabold tracking-normal text-balance break-words sm:text-6xl',
              classNames?.heading,
            )}
          >
            {heading}
          </h1>

          <p
            id={descriptionId}
            data-slot="global-error-boundary-description"
            className={cn(
              'text-primary-foreground/75 mx-auto max-w-xl min-w-0 text-base leading-7 break-words sm:text-lg sm:leading-8',
              classNames?.description,
            )}
          >
            {description}
          </p>
        </div>

        <p
          data-slot="global-error-boundary-error-message"
          className={cn(
            'border-primary-foreground/15 bg-primary-foreground/10 max-w-full min-w-0 rounded-lg border px-4 py-3 text-sm leading-6 text-pretty break-words backdrop-blur',
            classNames?.errorMessage,
          )}
        >
          {feedback.message}
        </p>

        <p
          data-slot="global-error-boundary-error-code"
          className={cn(
            'border-primary-foreground/15 bg-primary-foreground/10 max-w-full min-w-0 rounded-md border px-3 py-1.5 text-xs leading-5 font-semibold break-words backdrop-blur',
            classNames?.errorCode,
          )}
        >
          Error code:{' '}
          <span
            data-slot="global-error-boundary-error-code-value"
            className="font-mono break-all"
          >
            {displayedErrorCode}
          </span>
        </p>

        <div className="grid w-full max-w-sm min-w-0 gap-3">
          <Button
            aria-busy={isRefreshing}
            aria-label={
              typeof resolvedRefreshButtonLabel === 'string'
                ? resolvedRefreshButtonLabel
                : undefined
            }
            data-slot="global-error-boundary-refresh-button"
            disabled={isRefreshing}
            className={cn(
              'bg-primary-foreground text-primary enabled:hover:bg-primary-foreground/90 focus-visible:ring-primary-foreground focus-visible:ring-offset-primary dark:enabled:hover:bg-primary-foreground/85 w-full whitespace-normal wrap-anywhere shadow-lg shadow-black/20 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
              classNames?.refreshButton,
            )}
            size="lg"
            type="button"
            variant="secondary"
            onClick={() => void handleRefreshClick()}
          >
            {isRefreshing ? (
              <Spinner
                aria-hidden="true"
                data-icon="inline-start"
              />
            ) : (
              <RefreshCcw
                aria-hidden="true"
                data-icon="inline-start"
              />
            )}
            {resolvedRefreshButtonLabel}
          </Button>

          {refreshErrorMessage ? (
            <p
              data-slot="global-error-boundary-refresh-error"
              className={cn(
                'text-primary-foreground/75 text-sm leading-6 break-words',
                classNames?.refreshError,
              )}
            >
              Refresh failed: {refreshErrorMessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
};

/**
 * Renders the route-level global error boundary using React Router's thrown error.
 * @param props Optional copy, styling, and refresh behavior overrides.
 * @returns A React element that renders the global error recovery screen.
 * @example
 * import { createElement } from 'react';
 * import { createBrowserRouter } from 'react-router';
 * import { GlobalErrorBoundary } from 'jg-react-ui/components/global-error-boundary';
 * const router = createBrowserRouter([{ path: '/', element: 'Home', errorElement: createElement(GlobalErrorBoundary) }]);
 */
export const GlobalErrorBoundary = ({
  ref,
  tabIndex = -1,
  ...props
}: IGlobalErrorBoundaryProps): ReactElement => {
  const routeError = useRouteError();
  const recoveryReference = useRef<HTMLElement>(null);
  useImperativeHandle<HTMLElement | null, HTMLElement | null>(
    ref,
    () => recoveryReference.current,
    [],
  );
  useLayoutEffect(() => {
    recoveryReference.current?.focus({ preventScroll: true });
  }, [routeError]);

  return (
    <>
      <DialogNavigationObserver isErrorScreen />
      <GlobalErrorBoundaryView
        ref={recoveryReference}
        tabIndex={tabIndex}
        error={routeError}
        {...props}
      />
    </>
  );
};
