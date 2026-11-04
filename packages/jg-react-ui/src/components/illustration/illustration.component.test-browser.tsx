import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test } from 'vitest';

import { Illustration } from './illustration.component.js';
import type { IIllustrationName } from './types.js';

test.each<IIllustrationName>(['list', 'conversation', 'checklist', 'error', 'offline'])(
  'Illustration(%s) -> a decorative drawing in the theme tokens',
  (name) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <Illustration
          className="mx-auto"
          name={name}
        />,
      );
    });

    const drawing = container.querySelector('svg') as SVGSVGElement;
    expect(drawing.getAttribute('aria-hidden')).toBe('true');
    expect(drawing.dataset['illustration']).toBe(name);
    expect(drawing.getAttribute('viewBox')).toBe('0 0 160 110');
    expect(drawing.getAttribute('class')).toContain('mx-auto');
    expect(drawing.childElementCount).toBeGreaterThan(0);
    // every shape takes a theme token, never a fixed color
    for (const shape of drawing.querySelectorAll('*')) {
      expect(shape.getAttribute('fill') ?? 'none').toBe('none');
      expect(shape.getAttribute('stroke')).toBeNull();
    }
    act(() => {
      root.unmount();
    });
    container.remove();
  },
);
