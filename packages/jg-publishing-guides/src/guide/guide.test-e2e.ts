import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { expectToThrowCode } from 'jg-exception/testing';

import {
  ERRORS,
  renderPublishingGuide,
  type IPublishingGuide,
  type IPublishingGuideResult,
} from '../index.js';

const CAPTION = 'First line & literal <script>text</script>.\n\nSecond line.';
const FILES: IPublishingGuide['files'] = [
  { path: 'caption.txt', kind: 'file', label: 'Caption', details: 'Reviewed text.' },
  { path: 'video-title.txt', kind: 'file', label: 'Title', details: 'Reviewed title.' },
  { path: 'note.txt', kind: 'file', label: 'Repost note', details: 'Reviewed note.' },
  { path: 'packet.pdf', kind: 'file', label: 'Document', details: 'Reviewed PDF.' },
  {
    path: 'cards/intro.png',
    kind: 'image',
    label: 'First image',
    details: 'A reviewed artwork.',
    width: 480,
    height: 480,
  },
];
const COPY = new Map([
  ['caption.txt', CAPTION],
  ['video-title.txt', 'A separate title'],
  ['note.txt', 'An Instagram note'],
]);
const EDITORIAL_PACK: IPublishingGuide = {
  title: 'Offline <review> pack',
  summary: 'A neutral set of reviewed publishing instructions.',
  files: FILES,
  walkthrough: [
    {
      id: 'instagram-original',
      channel: 'instagram',
      caption: 'caption.txt',
      media: ['cards/intro.png'],
    },
    {
      id: 'founder',
      label: 'Founder',
      channel: 'instagram',
      caption: 'note.txt',
      media: [],
      repostOf: 'instagram-original',
    },
    {
      channel: 'linkedin',
      caption: 'caption.txt',
      media: ['packet.pdf'],
      documentTitle: 'A <literal> document title',
    },
  ],
};
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Loads a disposable guide with its actual browser CSP and same-origin attachment responses.
 * @param page The test page.
 * @param guide The rendered HTML and README.
 * @param probeScript Whether to add a script that must be blocked by CSP.
 */
const openGuide = async (
  page: Page,
  guide: IPublishingGuideResult,
  probeScript = false,
): Promise<void> => {
  const body = probeScript
    ? guide.html.replace(
        '</body>',
        '<script>document.documentElement.dataset.blockedProbe="executed";</script></body>',
      )
    : guide.html;
  await page.route('https://guide.example/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/start-here.html') return route.fulfill({ body, contentType: 'text/html' });
    if (pathname === '/cards/intro.png')
      return route.fulfill({ body: PNG, contentType: 'image/png' });
    if (pathname === '/packet.pdf')
      return route.fulfill({
        body: '%PDF-1.7\n% Test attachment\n',
        contentType: 'application/pdf',
        headers: { 'content-disposition': 'attachment; filename="packet.pdf"' },
      });
    if (pathname === '/readme.txt')
      return route.fulfill({ body: guide.readme, contentType: 'text/plain' });
    return route.abort();
  });
  await page.goto('https://guide.example/start-here.html');
};

test('preserves the English publishing steps, literal copy and selected document download', async ({
  page,
}) => {
  const guide = renderPublishingGuide(EDITORIAL_PACK, COPY);
  const script = /<script data-delivery-controls>([\s\S]+?)<\/script>/u.exec(guide.html)?.[1];
  expect(script).toBeDefined();
  expect(guide.html).toContain(
    `'sha256-${createHash('sha256')
      .update(script ?? '')
      .digest('base64')}'`,
  );
  expect(guide.html).toContain('&lt;script&gt;text&lt;/script&gt;');
  expect(guide.readme).toContain(CAPTION);
  await openGuide(page, guide, true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offline <review> pack');
  await expect(page.locator('html')).not.toHaveAttribute('data-blocked-probe', 'executed');
  const networks = page.getByRole('navigation', { name: 'Publishing networks' });
  const link = networks.getByRole('link', { name: 'LinkedIn' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Start your LinkedIn post' })).toBeFocused();
  await expect(link).toHaveAttribute('aria-current', 'location');
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue(
    'A <literal> document title',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Open packet.pdf' }).click();
  expect((await download).suggestedFilename()).toBe('packet.pdf');
  await expect(page.getByRole('link', { name: 'Read the plain-text guide' })).toHaveAttribute(
    'href',
    'readme.txt',
  );
});

test('keeps Spanish controls and manual copy usable at 320px in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('discard this fixture message')) },
    });
  });
  const guide = renderPublishingGuide(EDITORIAL_PACK, COPY, { locale: 'es' });
  await openGuide(page, guide);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('textbox', { name: 'Texto para Instagram' })).toHaveValue(CAPTION);
  const button = page.getByRole('button', { name: 'Copiar Texto para Instagram' });
  const buttonSize = await button.boundingBox();
  expect(buttonSize?.height).toBeGreaterThanOrEqual(44);
  await button.focus();
  await page.keyboard.press('Enter');
  const field = page.getByRole('textbox', { name: 'Texto para Instagram' });
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((textarea: HTMLTextAreaElement) => [
      textarea.selectionStart,
      textarea.selectionEnd,
    ]),
  ).toStrictEqual([0, CAPTION.length]);
  await expect(page.getByText('Texto seleccionado. Usa Copiar en tu dispositivo.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const darkText = await page.locator('body').evaluate((body) => getComputedStyle(body).color);
  await page.emulateMedia({ colorScheme: 'light' });
  const lightText = await page.locator('body').evaluate((body) => getComputedStyle(body).color);
  expect(lightText).not.toBe(darkText);
  await page
    .getByRole('navigation', { name: 'Guías de publicación' })
    .getByRole('link', { name: 'Founder' })
    .click();
  await expect(page.getByRole('heading', { name: 'Compartir desde Founder' })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Comentario de Founder' })).toHaveValue(
    'An Instagram note',
  );
});

test('announces copy success only after the write finishes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          document.documentElement.dataset['copiedFixture'] = text;
          return new Promise<void>((resolve) => {
            document.addEventListener('fixture-clipboard-complete', () => resolve(), {
              once: true,
            });
          });
        },
      },
    });
  });
  await openGuide(page, renderPublishingGuide(EDITORIAL_PACK, COPY));
  const copy = page.getByRole('button', { name: 'Copy Instagram caption' });
  await copy.click();
  await expect(page.getByText('Copying...', { exact: true })).toBeVisible();
  await expect(copy).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-copied-fixture', CAPTION);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('fixture-clipboard-complete'));
  });
  await expect(page.getByText('Copied.', { exact: true })).toBeVisible();
  await expect(copy).not.toHaveAttribute('aria-disabled');
});

test('keeps a reviewed TikTok title separate and supports older caption-only guides', async ({
  page,
}) => {
  const title: IPublishingGuide = {
    ...EDITORIAL_PACK,
    walkthrough: [
      {
        channel: 'tiktok',
        caption: 'caption.txt',
        postTitle: 'video-title.txt',
        media: ['cards/intro.png'],
      },
    ],
  };
  const withTitle = renderPublishingGuide(title, COPY);
  await openGuide(page, withTitle);
  await expect(page.getByRole('textbox', { name: 'TikTok title' })).toHaveValue('A separate title');
  await expect(page.getByRole('textbox', { name: 'TikTok description' })).toHaveValue(CAPTION);
  expect(withTitle.readme).toContain('Title:\nA separate title\nDescription:\n');
  const withoutTitle = renderPublishingGuide(
    {
      ...title,
      walkthrough: [{ channel: 'tiktok', caption: 'caption.txt', media: ['cards/intro.png'] }],
    },
    COPY,
  );
  expect(withoutTitle.readme).toContain('Copy the caption\n' + CAPTION);
  expect(withoutTitle.html).toContain('TikTok caption');
});

test('preserves a channel ID when another channel has no matching title field', async ({
  page,
}) => {
  const guide = renderPublishingGuide(
    {
      ...EDITORIAL_PACK,
      walkthrough: [
        {
          id: 'brand',
          label: 'Company',
          channel: 'instagram',
          caption: 'caption.txt',
          media: ['cards/intro.png'],
        },
        {
          id: 'brand-title',
          label: 'Company alternate',
          channel: 'instagram',
          caption: 'caption.txt',
          media: ['cards/intro.png'],
        },
      ],
    },
    COPY,
  );
  await openGuide(page, guide);
  await expect(page.locator('[id="brand-title"]')).toHaveCount(1);
  const alternate = page
    .getByRole('navigation', { name: 'Publishing networks' })
    .getByRole('link', { name: 'Company alternate' });
  await expect(alternate).toHaveAttribute('href', '#brand-title-start');
  await alternate.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#brand-title-start')).toBeFocused();
});

test('refuses paths and guide references that cannot safely render', () => {
  const bad: IPublishingGuide[] = [
    {
      ...EDITORIAL_PACK,
      files: [{ kind: 'file', path: '../escape.txt', label: 'Escape', details: 'Rejected' }],
    },
    {
      ...EDITORIAL_PACK,
      files: [{ kind: 'file', path: 'con.txt', label: 'Reserved', details: 'Rejected' }],
    },
    {
      ...EDITORIAL_PACK,
      files: [
        ...FILES,
        { kind: 'file', path: 'readme.txt', label: 'Collision', details: 'Rejected' },
      ],
    },
    {
      ...EDITORIAL_PACK,
      walkthrough: [
        {
          channel: 'linkedin',
          caption: 'missing.txt',
          media: ['packet.pdf'],
          documentTitle: 'Missing caption',
        },
      ],
    },
    {
      ...EDITORIAL_PACK,
      walkthrough: [{ id: 'late', channel: 'instagram', media: [], repostOf: 'missing' }],
    },
    {
      ...EDITORIAL_PACK,
      walkthrough: [
        { id: 'image', channel: 'instagram', caption: 'caption.txt', media: ['cards/intro.png'] },
        {
          id: 'image-alt-1',
          channel: 'instagram',
          caption: 'caption.txt',
          media: ['cards/intro.png'],
        },
      ],
    },
    {
      ...EDITORIAL_PACK,
      walkthrough: [
        {
          id: 'brand',
          channel: 'tiktok',
          caption: 'caption.txt',
          postTitle: 'video-title.txt',
          media: ['cards/intro.png'],
        },
        {
          id: 'brand-title',
          channel: 'instagram',
          caption: 'caption.txt',
          media: ['cards/intro.png'],
        },
      ],
    },
  ];
  for (const input of bad) {
    expectToThrowCode(
      () => renderPublishingGuide(input, COPY),
      ERRORS.INVALID_PUBLISHING_GUIDE,
      'The publishing guide input is invalid.',
    );
  }
});
