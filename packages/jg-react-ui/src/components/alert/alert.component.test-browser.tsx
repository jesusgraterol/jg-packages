import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { Alert, AlertAction, AlertDescription, AlertTitle } from './index.js';

afterEach(cleanup);

test('Alert composes a static live region and supplementary action', async () => {
  const ref = createRef<HTMLDivElement>();
  const onClick = vi.fn();
  render(
    <Alert ref={ref}>
      <svg aria-hidden="true" />
      <AlertTitle>Saved</AlertTitle>
      <AlertDescription>Your work is ready.</AlertDescription>
      <AlertAction>
        <button onClick={onClick}>Undo</button>
      </AlertAction>
    </Alert>,
  );
  const alert = screen.getByRole('alert');
  expect(ref.current).toBe(alert);
  expect(alert.dataset['variant']).toBe('default');
  expect(alert.dataset['interaction']).toBe('static');
  expect(screen.getByText('Saved').tagName).toBe('SPAN');
  expect(screen.getByText('Your work is ready.').tagName).toBe('SPAN');
  expect(alert.className).toContain('has-[>svg]:[&>:not(svg):not([data-slot=alert-action])]:pl-7');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('Alert redirects using native links without a live-region role', () => {
  render(
    <Alert
      asChild
      interaction="redirect"
      variant="destructive"
    >
      <a href="#details">
        <AlertTitle>Review issue</AlertTitle>
      </a>
    </Alert>,
  );
  const link = screen.getByRole('link', { name: 'Review issue' });
  expect(link.getAttribute('href')).toBe('#details');
  expect(link.hasAttribute('role')).toBe(false);
  expect(link.dataset['interaction']).toBe('redirect');
  expect(link.dataset['variant']).toBe('destructive');
});

test('Alert actions retain native keyboard, disabled behavior, and an explicit role override', async () => {
  const onClick = vi.fn();
  const { rerender } = render(
    <Alert
      asChild
      interaction="action"
      onClick={onClick}
    >
      <button type="button">
        <AlertTitle>Retry</AlertTitle>
      </button>
    </Alert>,
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <Alert
      asChild
      interaction="action"
      onClick={onClick}
    >
      <button
        disabled
        type="button"
      >
        Retry
      </button>
    </Alert>,
  );
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  screen.getByRole('button').click();
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(<Alert role="status">Synced</Alert>);
  expect(screen.getByRole('status').textContent).toBe('Synced');
});
