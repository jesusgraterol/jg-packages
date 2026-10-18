import { afterEach, describe, expect, test } from 'vitest';

import { registerSectionTracking } from './section-tracking-behavior.ts';

/*
 * Section tracking on a real page in Chromium, Firefox, and WebKit: a sticky header with section
 * links in two navigations, and tall sections, the last one short.
 */

// stops tracking after each test
let stopTracking: (() => void) | undefined;

/**
 * Renders the page and starts tracking.
 * @returns The links of each navigation.
 */
const renderPage = () => {
  document.body.innerHTML = `
    <header id="header" style="position: sticky; top: 0; height: 64px; background: white">
      <nav aria-label="Primary navigation">
        <a href="#about" data-section-link="about">About</a>
        <a href="#projects" data-section-link="projects">Projects</a>
        <a href="#contact" data-section-link="contact">Contact</a>
      </nav>
      <nav aria-label="Mobile navigation">
        <a href="#about" data-section-link="about">About</a>
      </nav>
    </header>
    <div style="height: 300px">Hero</div>
    <section id="about" style="height: 1200px">About</section>
    <section id="projects" style="height: 1200px">Projects</section>
    <section id="contact" style="height: 200px">Contact</section>
  `;
  stopTracking = registerSectionTracking(document.getElementById('header') as HTMLElement);
};

/**
 * Scrolls the page and waits for tracking to catch up.
 * @param top The scroll position.
 */
const scrollToTop = async (top: number): Promise<void> => {
  window.scrollTo(0, top);
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
};

/**
 * Lists the sections whose links are marked current, one entry per link.
 * @returns The section ids.
 */
const currentSections = (): (string | null)[] =>
  [...document.querySelectorAll('[aria-current="location"]')].map((link) =>
    link.getAttribute('data-section-link'),
  );

afterEach(() => {
  stopTracking?.();
  document.body.innerHTML = '';
  window.scrollTo(0, 0);
});

describe('section tracking', () => {
  test('marks nothing above the first section, then each section as it reaches the header', async () => {
    renderPage();
    await scrollToTop(0);
    expect(currentSections()).toStrictEqual([]);

    await scrollToTop(300);
    expect(currentSections()).toStrictEqual(['about', 'about']);

    await scrollToTop(1600);
    expect(currentSections()).toStrictEqual(['projects']);
  });

  test('marks the short last section at the end of the page', async () => {
    renderPage();
    await scrollToTop(document.documentElement.scrollHeight);

    expect(currentSections()).toStrictEqual(['contact']);
  });
});
