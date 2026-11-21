import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

import { ERRORS, withOfflineRenderer, type IHtmlRenderInput } from '../index.js';

const CANVAS = { width: 120, height: 80 };
const HTML = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>';

const firstPixelAlpha = (png: Buffer): number | undefined => {
  const compressed: Buffer[] = [];
  for (let offset = 8; offset + 8 <= png.byteLength;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      compressed.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);
  return inflateSync(Buffer.concat(compressed))[4];
};

test('renders exact transparent PNGs and reuses one context across a batch', async ({
  browser,
}) => {
  const png = await withOfflineRenderer(browser, { locale: 'en-US' }, async (renderer) => {
    const contexts = browser.contexts();
    expect(contexts).toHaveLength(1);
    let calls = 0;
    const first = await renderer.renderPng({
      ...CANVAS,
      html: HTML + '<body><svg width="24" height="24"></svg></body>',
      transparent: true,
      layout: async (page) => {
        await expect(page.locator('svg')).toHaveAttribute('height', '24');
        expect(page.context()).toBe(contexts[0]);
        calls += 1;
      },
    });
    const second = await renderer.renderPng({ html: HTML, width: 64, height: 32 });
    expect(second.readUInt32BE(16)).toBe(64);
    expect(contexts[0]?.pages()).toHaveLength(0);
    expect(calls).toBe(1);
    return first;
  });
  expect(png.readUInt32BE(16)).toBe(CANVAS.width);
  expect(png.readUInt32BE(20)).toBe(CANVAS.height);
  expect(firstPixelAlpha(png)).toBe(0);
  expect(browser.contexts()).toHaveLength(0);
  expect(browser.isConnected()).toBe(true);
});

test('loads exact font faces and decoded images before the layout hook and the local PDF callback', async ({
  browser,
}) => {
  const woff = await readFile(
    new URL(
      import.meta
        .resolve('@fontsource-variable/ubuntu-sans/files/ubuntu-sans-latin-wght-normal.woff2'),
    ),
  );
  const html =
    HTML +
    `<style>@font-face{font-family:"Render Fixture";font-weight:500;src:url(data:font/woff2;base64,${woff.toString('base64')})}p{font:500 12px "Render Fixture"}</style><body>
    <p id="copy">Offline PDF</p>
    <img loading="lazy" alt="Test image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='9'/%3E">
    <script>document.querySelector('p').textContent='executed'</script>
  </body>`;
  const pdf = await withOfflineRenderer(browser, {}, (renderer) =>
    renderer.preparePage(
      {
        ...CANVAS,
        html,
        requiredFonts: [{ family: 'Render Fixture', weight: '500' }],
        layout: async (page) => {
          const observed = await page.evaluate(() => ({
            font: [...document.fonts][0]?.status,
            width: document.images[0]?.naturalWidth,
            motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            pixelRatio: devicePixelRatio,
            connected: navigator.onLine,
          }));
          expect(observed).toStrictEqual({
            font: 'loaded',
            width: 12,
            motion: true,
            pixelRatio: 1,
            connected: false,
          });
          await expect(page.getByText('Offline PDF')).toBeVisible();
        },
      },
      (page) => page.pdf({ printBackground: true }),
    ),
  );
  expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(browser.contexts()).toHaveLength(0);
});

test('fails closed before an HTTP request reaches the network, without echoing the URL', async ({
  browser,
}) => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a loopback port');
    await expect(
      withOfflineRenderer(browser, {}, (renderer) =>
        renderer.renderPng({
          ...CANVAS,
          html: HTML + `<img src="http://127.0.0.1:${address.port}/fixture-private-resource">`,
        }),
      ),
    ).rejects.toMatchObject({
      code: ERRORS.HTML_RENDER_FAILED,
      message: 'The HTML could not be rendered to PNG.',
      data: { reason: 'network' },
    });
    expect(requests).toBe(0);
    expect(browser.contexts()).toHaveLength(0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('reports safe reasons for missing fonts, broken images, and layout overflow', async ({
  browser,
}) => {
  await withOfflineRenderer(browser, {}, async (renderer) => {
    const failures: [IHtmlRenderInput, string][] = [
      [{ ...CANVAS, html: HTML, requiredFonts: [{ family: 'Missing Fixture Font' }] }, 'font'],
      [{ ...CANVAS, html: HTML + '<img src="data:image/png;base64,not-image">' }, 'image'],
      [{ ...CANVAS, html: HTML, layout: () => Promise.resolve('overflow' as const) }, 'overflow'],
      [
        {
          ...CANVAS,
          html: HTML,
          layout: () => Promise.reject(new Error('fixture-private-layout')),
        },
        'layout',
      ],
    ];
    for (const [input, reason] of failures) {
      await expect(renderer.renderPng(input)).rejects.toMatchObject({
        code: ERRORS.HTML_RENDER_FAILED,
        message: 'The HTML could not be rendered to PNG.',
        data: { reason },
      });
    }
    await expect(renderer.renderPng({ ...CANVAS, html: HTML, timeoutMs: 0 })).rejects.toMatchObject(
      {
        code: ERRORS.INVALID_HTML_RENDER_OPTIONS,
        message: 'The HTML render options are invalid.',
      },
    );
    expect(browser.contexts()[0]?.pages()).toHaveLength(0);
  });
  expect(browser.contexts()).toHaveLength(0);
});

test('cancels pending layout and closes its owned context', async ({ browser }) => {
  const cancellation = new AbortController();
  const layoutStarted = Promise.withResolvers<void>();
  const layout = Promise.withResolvers<void>();
  const operation = withOfflineRenderer(browser, { signal: cancellation.signal }, (renderer) =>
    renderer.renderPng({
      ...CANVAS,
      html: HTML,
      layout: () => {
        layoutStarted.resolve();
        return layout.promise;
      },
    }),
  );
  try {
    await layoutStarted.promise;
    cancellation.abort(new Error('fixture-private-cancellation'));
    await expect(operation).rejects.toMatchObject({
      code: ERRORS.HTML_RENDER_FAILED,
      message: 'The HTML could not be rendered to PNG.',
      data: { reason: 'cancelled' },
    });
    expect(browser.contexts()).toHaveLength(0);
    expect(browser.isConnected()).toBe(true);
  } finally {
    layout.resolve();
  }
});

test('bounds the page layout and allows a new render after a timeout', async ({ browser }) => {
  const blockedLayout = Promise.withResolvers<void>();
  await withOfflineRenderer(browser, {}, async (renderer) => {
    try {
      await expect(
        renderer.renderPng({
          ...CANVAS,
          html: HTML,
          timeoutMs: 1000,
          layout: () => blockedLayout.promise,
        }),
      ).rejects.toMatchObject({ code: ERRORS.HTML_RENDER_FAILED, data: { reason: 'timeout' } });
      expect(browser.contexts()[0]?.pages()).toHaveLength(0);
      expect(await renderer.renderPng({ ...CANVAS, html: HTML })).toBeInstanceOf(Buffer);
    } finally {
      blockedLayout.resolve();
    }
  });
  expect(browser.contexts()).toHaveLength(0);
});
