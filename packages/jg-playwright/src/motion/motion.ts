import type { Page } from '@playwright/test';

import type { IMotionInspection, IMovingAnimation, ISpatialProperty } from './types.js';

/**
 * Lists, in the page, the running keyframe animations that move or resize an element. Playwright
 * runs this function in the browser, so it uses nothing from outside its own body.
 * @returns The reduced-motion preference and the moving animations.
 */
const inspectAnimations = (): IMotionInspection => {
  const spatialProperties: ISpatialProperty[] = [
    'transform',
    'translate',
    'scale',
    'rotate',
    'width',
    'height',
  ];
  const movingAnimations: IMovingAnimation[] = [];
  for (const animation of document.getAnimations()) {
    if (
      animation.playState !== 'running' ||
      !(animation.effect instanceof KeyframeEffect) ||
      animation.effect.target === null
    ) {
      continue;
    }
    const frames = animation.effect.getKeyframes();
    // a property set in some keyframes only, or to different values, changes during the animation
    const properties = spatialProperties.filter((property) => {
      const values = frames
        .map((frame) => frame[property])
        .filter((value) => typeof value === 'string');
      return (
        values.length > 0 &&
        (frames.length < 2 || values.length !== frames.length || new Set(values).size > 1)
      );
    });
    if (properties.length === 0) {
      continue;
    }
    const { target } = animation.effect;
    const { duration, iterations } = animation.effect.getTiming();
    movingAnimations.push({
      tagName: target.tagName.toLowerCase(),
      slot: target.getAttribute('data-slot'),
      properties,
      iterations: iterations === Infinity ? 'infinite' : (iterations ?? 1),
      durationMs: typeof duration === 'number' ? duration : null,
    });
  }
  return {
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    movingAnimations,
  };
};

/**
 * Lists the animations running in the page that move or resize an element, with whether the page
 * sees `prefers-reduced-motion: reduce`, so a test can check that reduced motion stops them. An
 * animation counts when it changes `transform`, `translate`, `scale`, `rotate`, `width`, or
 * `height`. Fades and color changes don't, because they're safe with reduced motion.
 * @param page The page.
 * @returns A promise that resolves to the preference and the moving animations.
 * @example
 * import { expect, test } from '@playwright/test';
 * import { inspectMotion } from 'jg-playwright';
 *
 * test.use({ reducedMotion: 'reduce' });
 *
 * test('the dialog opens without moving', async ({ page }) => {
 *   await page.goto('/settings');
 *   await page.getByRole('button', { name: 'Delete account' }).click();
 *   const { prefersReducedMotion, movingAnimations } = await inspectMotion(page);
 *   expect(prefersReducedMotion).toBe(true);
 *   expect(movingAnimations).toStrictEqual([]);
 * });
 */
export const inspectMotion = (page: Page): Promise<IMotionInspection> =>
  page.evaluate(inspectAnimations);
