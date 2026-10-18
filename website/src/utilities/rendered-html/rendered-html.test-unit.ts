// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { decodeHtmlEntities, findUnsafeAttributes, isUnsafeUrl } from './rendered-html.ts';

// what a Markdown renderer emits for safe content: an autolink, escaped text, inline
// code, a link title and image alt text holding a raw <, a heading, a table, and a code block
const SAFE_RENDERED_MARKDOWN = [
  '<h2 id="rules">Rules</h2>',
  '<p><a href="https://example.com">https://example.com</a> and a &lt; b and <code>&lt;dialog&gt;</code> and <a href="https://x.dev" title="a<b>c">t</a> and <img src="https://x.dev/i.png" alt="alt <b>"></p>',
  '<p>Mail <a href="mailto:dev@example.com">dev</a>, read <a href="references/forms.md">forms</a>, or see <a href="https://x.dev/?a=1&#x26;b=2">x</a>.<br></p>',
  '<table>\n<thead>\n<tr>\n<th>Object</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td><strong>Table</strong></td>\n</tr>\n</tbody>\n</table>',
  '<ul>\n<li><input type="checkbox" checked disabled> done</li>\n</ul>',
  '<pre class="astro-code astro-code-themes github-light-default github-dark-default" style="background-color:#ffffff;--shiki-dark-bg:#0d1117;color:#1f2328;--shiki-dark:#e6edf3; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;" tabindex="0" data-language="bash"><code><span class="line"><span style="color:#6E7781;--shiki-dark:#8B949E"># Usage: archive-uploads.sh [-h] &lt;archive-path&gt;</span></span></code></pre>',
].join('\n');

describe('decodeHtmlEntities', () => {
  test('decodes decimal, hexadecimal, and common named references', () => {
    expect(decodeHtmlEntities('&#106;&#x61;&amp;&LT;&quot;&apos;&gt;')).toBe('ja&<"\'>');
  });

  test('decodes each reference once and leaves unknown named references as written', () => {
    expect(decodeHtmlEntities('&#x26;#106; &colon; &copy;')).toBe('&#106; &colon; &copy;');
  });

  test('reads a reference beyond the last code point as the replacement character', () => {
    expect(decodeHtmlEntities('&#x110000;&#99999999999;')).toBe('\uFFFD\uFFFD');
  });
});

describe('isUnsafeUrl', () => {
  test.each([
    'https://example.com/path?q=1#top',
    'http://example.com',
    'MAILTO:dev@example.com',
    '/skills/jg-plan/',
    'references/forms.md',
    '#install',
    'java%09script:alert(1)',
    'https://x.dev/?a=1&amp;b=2',
  ])('accepts %s', (url) => {
    expect(isUnsafeUrl(url)).toBe(false);
  });

  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    '&#106;avascript:alert(1)',
    '&#x6A;avascript:alert(1)',
    'java&#x09;script:alert(1)',
    'java\nscript:alert(1)',
    ' \u0001javascript:alert(1)',
    'javascript&colon;alert(1)',
    'jav&Tab;ascript:alert(1)',
    '&#106avascript:alert(1)',
    'ftp://example.com/file',
  ])('rejects %s', (url) => {
    expect(isUnsafeUrl(url)).toBe(true);
  });
});

describe('findUnsafeAttributes', () => {
  test('finds nothing in safe rendered Markdown', () => {
    expect(findUnsafeAttributes(SAFE_RENDERED_MARKDOWN)).toBeUndefined();
  });

  test('accepts a page whose scripts and styles hold markup-like code', () => {
    const page = [
      '<!DOCTYPE html><html lang="en"><head>',
      '<link rel="icon" href="/favicon.svg"><script type="module" src="/_astro/page.js"></script>',
      '<script type="module">if (a <b && c) el.innerHTML = "<img onerror=x>";</script>',
      '<style>a[href^="javascript:"] { color: red; }</style>',
      '</head><body><a href="https://x.dev" title="a > b">x</a></body></html>',
    ].join('');

    expect(findUnsafeAttributes(page)).toBeUndefined();
  });

  test.each([
    ['an event handler', '<body onload="alert(1)">', 'onload attribute'],
    ['a handler after a slash', '<img/src="x"/onerror=alert(1)>', 'onerror attribute'],
    ['a handler after a quoted >', '<a title="a > b" onclick="x">', 'onclick attribute'],
    ['a script URL', '<a href="&#106;avascript:alert(1)">x</a>', 'href="&#106;avascript:alert(1)"'],
    ['a form action', '<button formaction="javascript:alert(1)">x</button>', 'formaction='],
  ])('rejects %s', (_caseName, html, problem) => {
    expect(findUnsafeAttributes(html)).toContain(problem);
  });
});
