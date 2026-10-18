// the attribute a navigation link carries when it leads to a section of the same page, holding the
// section's id
export const SECTION_LINK_ATTRIBUTE = 'data-section-link';

// a section's id and the distance from the viewport's top to its top, in pixels
export type ISectionPosition = { id: string; top: number };

/**
 * Finds the section the reader is in: the last one whose top has scrolled past the line under the
 * sticky header. At the page's end, the last section wins, even when it is too short to reach the
 * line.
 * @param sections The sections, in page order.
 * @param activationOffset The line's distance from the viewport's top: the header's height.
 * @param isAtEnd Whether the page is scrolled to its end.
 * @returns The section's id, or undefined above the first section.
 */
export const findActiveSectionId = (
  sections: readonly ISectionPosition[],
  activationOffset: number,
  isAtEnd: boolean,
): string | undefined => {
  if (isAtEnd && sections.length > 0) {
    return sections.at(-1)?.id;
  }
  let activeId: string | undefined;
  for (const { id, top } of sections) {
    if (top > activationOffset) {
      break;
    }
    activeId = id;
  }
  return activeId;
};

/**
 * Marks the navigation links of the section the reader is in with aria-current="location", and
 * keeps them current while the page scrolls, resizes, or follows a hash, at most once a frame.
 * Links carry their section's id in data-section-link.
 * @param header The site header, whose height sets the line a section must pass.
 * @returns A function that stops tracking.
 */
export const registerSectionTracking = (header: HTMLElement): (() => void) => {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(`[${SECTION_LINK_ATTRIBUTE}]`)];
  const sections = [...new Set(links.map((link) => link.getAttribute(SECTION_LINK_ATTRIBUTE)))]
    .map((id) => (id === null ? null : document.getElementById(id)))
    .filter((section): section is HTMLElement => section !== null);
  const update = (): void => {
    const root = document.documentElement;
    const activeId = findActiveSectionId(
      sections.map((section) => ({ id: section.id, top: section.getBoundingClientRect().top })),
      header.offsetHeight + 1,
      window.scrollY + window.innerHeight >= root.scrollHeight - 1,
    );
    for (const link of links) {
      if (link.getAttribute(SECTION_LINK_ATTRIBUTE) === activeId) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  };
  let isScheduled = false;
  const schedule = (): void => {
    if (isScheduled) {
      return;
    }
    isScheduled = true;
    window.requestAnimationFrame(() => {
      isScheduled = false;
      update();
    });
  };
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('hashchange', schedule);
  };
};
