import { useCallback } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cnfast';
import { canQueryLoadMore, isQueryLoadingMore } from 'jg-tanstack-query';

import { Button } from '../button/index.js';
import { Spinner } from '../spinner/index.js';

import type { ILoadMoreButtonProps } from './types.js';
import {
  LOAD_MORE_BUTTON_DEFAULT_LABEL,
  LOAD_MORE_BUTTON_DEFAULT_LOADING_LABEL,
} from './constants.js';

/**
 * Renders a reusable load-more command with customizable idle and loading presentation.
 * Visible text supplies its accessible name unless the corresponding ARIA label is explicitly set.
 * @param props The infinite query plus load-more labels, icons, and shared button props.
 * @returns A React element that renders the load-more control, or null when no page remains.
 * @example
 * import { createElement } from 'react';
 * import { LoadMoreButton } from 'jg-react-ui/components/load-more-button';
 * const example = createElement(LoadMoreButton, { query: { isError: false, hasNextPage: true, fetchNextPage: async () => undefined } });
 */
export const LoadMoreButton = ({
  'aria-busy': ariaBusy,
  'aria-label': ariaLabel,
  className,
  classNames,
  disabled,
  icon,
  iconPlacement = 'start',
  label = LOAD_MORE_BUTTON_DEFAULT_LABEL,
  loadingAriaLabel,
  loadingIcon,
  loadingLabel = LOAD_MORE_BUTTON_DEFAULT_LOADING_LABEL,
  onClick,
  query,
  shouldDisableWhenLoading = true,
  size = 'default',
  variant = 'outline',
  ...props
}: ILoadMoreButtonProps): ReactElement | null => {
  const canLoadMore = canQueryLoadMore(query);
  const fetchNextPage = query.fetchNextPage;
  const isLoadingMore = isQueryLoadingMore(query);
  const buttonAriaLabel = isLoadingMore ? loadingAriaLabel : ariaLabel;
  const buttonIcon = isLoadingMore
    ? (loadingIcon ?? <Spinner aria-hidden="true" />)
    : (icon ?? (
        <ChevronDown
          aria-hidden="true"
          data-slot="load-more-button-default-icon"
        />
      ));
  const iconDataAttribute = iconPlacement === 'end' ? 'inline-end' : 'inline-start';
  const iconElement =
    buttonIcon === null ? null : (
      <span
        aria-hidden="true"
        data-icon={iconDataAttribute}
        data-slot="load-more-button-icon"
        className={cn('inline-flex shrink-0 items-center', classNames?.icon)}
      >
        {buttonIcon}
      </span>
    );
  const shouldDisableButton = disabled === true || (isLoadingMore && shouldDisableWhenLoading);

  /**
   * Preserves consumer click handling before requesting the next query page.
   * @param event The button click event.
   */
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      onClick?.(event);

      if (event.defaultPrevented || !canLoadMore || isLoadingMore) {
        return;
      }

      void fetchNextPage();
    },
    [canLoadMore, fetchNextPage, isLoadingMore, onClick],
  );

  if (!canLoadMore) {
    return null;
  }

  return (
    <div
      data-loading={isLoadingMore ? 'true' : 'false'}
      data-slot="load-more-button-root"
      className={cn('mt-3 flex w-full justify-center pt-1', className)}
    >
      <Button
        aria-busy={isLoadingMore ? true : ariaBusy}
        aria-label={buttonAriaLabel}
        data-loading={isLoadingMore ? 'true' : 'false'}
        data-slot="load-more-button"
        disabled={shouldDisableButton}
        size={size}
        type="button"
        variant={variant}
        className={cn(
          'min-w-0 w-full whitespace-normal pointer-coarse:min-h-11 pointer-coarse:min-w-11 sm:w-auto',
          classNames?.button,
        )}
        onClick={handleClick}
        {...props}
      >
        {iconPlacement === 'start' ? iconElement : null}
        <span
          data-slot="load-more-button-label"
          className={cn('min-w-0 wrap-anywhere', classNames?.label)}
        >
          {isLoadingMore ? loadingLabel : label}
        </span>
        {iconPlacement === 'end' ? iconElement : null}
      </Button>
    </div>
  );
};
