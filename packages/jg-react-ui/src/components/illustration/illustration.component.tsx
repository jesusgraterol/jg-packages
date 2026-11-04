import type * as React from 'react';
import { cn } from 'cnfast';

import type { IIllustrationName, IIllustrationProps } from './types.js';

// each illustration's shapes on a 160 by 110 canvas, colored by the theme's tokens
const DRAWINGS: Record<IIllustrationName, React.ReactNode> = {
  list: (
    <>
      <rect
        className="fill-secondary"
        height="62"
        rx="12"
        width="96"
        x="20"
        y="26"
      />
      <rect
        className="fill-background stroke-border"
        height="62"
        rx="12"
        strokeWidth="1.5"
        width="100"
        x="38"
        y="38"
      />
      <rect
        className="fill-border"
        height="7"
        rx="3.5"
        width="56"
        x="52"
        y="54"
      />
      <rect
        className="fill-border"
        height="7"
        rx="3.5"
        width="36"
        x="52"
        y="68"
      />
      <rect
        className="fill-border"
        height="7"
        rx="3.5"
        width="46"
        x="52"
        y="82"
      />
      <circle
        className="fill-running-tint"
        cx="130"
        cy="32"
        r="16"
      />
      <path
        className="fill-none stroke-running"
        d="M130 25v14M123 32h14"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </>
  ),
  conversation: (
    <>
      <rect
        className="fill-secondary"
        height="30"
        rx="12"
        width="78"
        x="16"
        y="20"
      />
      <rect
        className="fill-border"
        height="6"
        rx="3"
        width="44"
        x="28"
        y="32"
      />
      <rect
        className="fill-background stroke-border"
        height="30"
        rx="12"
        strokeWidth="1.5"
        width="78"
        x="66"
        y="58"
      />
      <circle
        className="fill-secondary-foreground"
        cx="86"
        cy="73"
        r="3"
      />
      <circle
        className="fill-secondary-foreground"
        cx="98"
        cy="73"
        r="3"
      />
      <circle
        className="fill-secondary-foreground"
        cx="110"
        cy="73"
        r="3"
      />
      <circle
        className="fill-done-tint"
        cx="32"
        cy="80"
        r="12"
      />
      <path
        className="fill-none stroke-done"
        d="M27 80l4 4 7-8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </>
  ),
  checklist: (
    <>
      <rect
        className="fill-secondary"
        height="78"
        rx="12"
        width="70"
        x="30"
        y="18"
      />
      <rect
        className="fill-background stroke-border"
        height="78"
        rx="12"
        strokeWidth="1.5"
        width="70"
        x="46"
        y="24"
      />
      <path
        className="fill-none stroke-done"
        d="M58 44l4 4 7-8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <rect
        className="fill-border"
        height="6"
        rx="3"
        width="28"
        x="76"
        y="41"
      />
      <path
        className="fill-none stroke-done"
        d="M58 62l4 4 7-8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <rect
        className="fill-border"
        height="6"
        rx="3"
        width="22"
        x="76"
        y="59"
      />
      <circle
        className="fill-none stroke-border"
        cx="63"
        cy="81"
        r="5"
        strokeWidth="2"
      />
      <rect
        className="fill-border"
        height="6"
        rx="3"
        width="26"
        x="76"
        y="78"
      />
      <circle
        className="fill-waiting-tint"
        cx="128"
        cy="30"
        r="14"
      />
      <path
        className="fill-none stroke-waiting"
        d="M128 23v8l5 3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </>
  ),
  error: (
    <>
      <path
        className="fill-none stroke-secondary-foreground"
        d="M6 62h16M66 55h12M66 69h12M140 62h14"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <rect
        className="fill-secondary stroke-border"
        height="32"
        rx="9"
        strokeWidth="1.5"
        width="44"
        x="22"
        y="46"
      />
      <rect
        className="fill-secondary stroke-border"
        height="32"
        rx="9"
        strokeWidth="1.5"
        width="44"
        x="96"
        y="46"
      />
      <path
        className="fill-none stroke-failed"
        d="M88 22l-7 14h9l-7 14"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle
        className="fill-failed-tint"
        cx="87"
        cy="94"
        r="5"
      />
    </>
  ),
  offline: (
    <>
      <path
        className="fill-secondary stroke-border"
        d="M48 86h66a22 22 0 0 0 1-44 30 30 0 0 0-57-5 20 20 0 0 0-10 49z"
        strokeWidth="1.5"
      />
      <path
        className="fill-none stroke-secondary-foreground"
        d="M62 70a26 26 0 0 1 36 0"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle
        className="fill-secondary-foreground"
        cx="80"
        cy="78"
        r="3.5"
      />
      <path
        className="fill-none stroke-waiting"
        d="M40 20l80 74"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
    </>
  ),
};

/**
 * Renders a small decorative drawing for an empty state or a failure: a list, a conversation or
 * a checklist with nothing in it yet, an error, or being offline. Its shapes take the theme's
 * tokens, so it follows the light and dark themes, and it's hidden from assistive technology,
 * since the text beside it says what it shows.
 * @param props The illustration, and the classes that place it.
 * @returns A React element that renders the drawing.
 * @example
 * import { createElement } from 'react';
 * import { Illustration } from 'jg-react-ui/components/illustration';
 * const example = createElement(Illustration, { name: 'offline' });
 */
export const Illustration = ({ name, className }: IIllustrationProps): React.ReactElement => (
  <svg
    aria-hidden="true"
    className={cn('h-27.5 w-40 shrink-0', className)}
    data-illustration={name}
    data-slot="illustration"
    height="110"
    viewBox="0 0 160 110"
    width="160"
    xmlns="http://www.w3.org/2000/svg"
  >
    {DRAWINGS[name]}
  </svg>
);
