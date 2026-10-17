import { describe, expect, it } from 'vitest';
import {
  countWords,
  markdownToPlainText,
  readingMinutes,
  renderMarkdown,
  safeHref,
  slugifyHeading
} from '../../src/lib/server/content/markdown';

describe('renderMarkdown', () => {
  it('renders headings, paragraphs and lists', () => {
    const result = renderMarkdown('# Title\n\nA paragraph.\n\n- one\n- two');
    expect(result.html).toContain('<h1 id="title">Title</h1>');
    expect(result.html).toContain('<p>A paragraph.</p>');
    expect(result.html).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders inline emphasis, code and links', () => {
    const result = renderMarkdown('**bold** and *italic* and `code` and [link](https://x.com)');
    expect(result.html).toContain('<strong>bold</strong>');
    expect(result.html).toContain('<em>italic</em>');
    expect(result.html).toContain('<code>code</code>');
    expect(result.html).toContain('<a href="https://x.com/"');
    // External links must not leak referrer data or window.opener.
    expect(result.html).toContain('rel="noopener noreferrer"');
  });

  it('renders blockquotes, rules and fenced code', () => {
    const result = renderMarkdown('> a quote\n\n---\n\n```js\nconst a = 1;\n```');
    expect(result.html).toContain('<blockquote><p>a quote</p></blockquote>');
    expect(result.html).toContain('<hr />');
    expect(result.html).toContain('<pre><code class="language-js">');
  });

  it('escapes HTML inside fenced code instead of executing it', () => {
    const result = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).not.toContain('<script>alert(1)</script>');
  });

  it('gives heading ids that are unique', () => {
    const result = renderMarkdown('## Same\n\n## Same\n\n## Same');
    expect(result.headings.map((h) => h.id)).toEqual(['same', 'same-2', 'same-3']);
  });

  it('counts words and estimates reading time from real content', () => {
    const body = Array.from({ length: 120 }, () => 'word').join(' ');
    expect(countWords(body)).toBe(120);
    // 120 words at 200 wpm rounds to 1 minute, with a floor of 1.
    expect(readingMinutes(body)).toBe(1);
    expect(readingMinutes('')).toBe(0);
  });

  it('converts Persian titles to slugs without dropping them', () => {
    const used = new Set<string>();
    expect(slugifyHeading('اپیزود ۴۳', used)).not.toBe('');
    expect(used.size).toBe(1);
  });
});

describe('renderMarkdown — XSS safety', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<iframe src="https://evil.example.com"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
    '<div style="background:url(javascript:alert(1))">text</div>',
    '<object data="evil.swf"></object>',
    '<form action="https://evil.example.com"><input name="a"></form>',
    '<math><mtext><table><mglyph><svg><mtext><style><path><foreignobject>' +
      '<iframe onload="alert(1)"></iframe></foreignobject></style></mtext></svg></mglyph></table></mtext></math>',
    '<p onclick="alert(1)">text</p>',
    '[link](javascript:alert(1))',
    '[link](data:text/html,<script>alert(1)</script>)',
    '![img](https://x.com/a.png") onerror="alert(1)',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<base href="javascript:alert(1)//">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example.com">'
  ];

  for (const payload of payloads) {
    it(`never emits executable markup for: ${payload.slice(0, 40)}`, () => {
      const result = renderMarkdown(payload);
      // Every dangerous construct must be escaped, i.e. present as literal
      // text ("&lt;script&gt;") rather than a live element ("<script>").
      expect(result.html).not.toMatch(/<script/i);
      expect(result.html).not.toMatch(/<iframe/i);
      expect(result.html).not.toMatch(/<object/i);
      expect(result.html).not.toMatch(/<embed/i);
      expect(result.html).not.toMatch(/<svg/i);
      expect(result.html).not.toMatch(/<base/i);
      expect(result.html).not.toMatch(/<meta/i);
      expect(result.html).not.toMatch(/<form/i);
      // A handler attribute only counts if it sits inside a live tag: an
      // escaped "&lt;img onerror=...&gt;" is inert text.
      const tags = result.html.match(/<[a-z][^>]*>/gi) ?? [];
      for (const tag of tags) {
        expect(tag).not.toMatch(/\son\w+\s*=/i);
      }
      expect(result.html).not.toMatch(/<a[^>]+href\s*=\s*["']?\s*(javascript|vbscript|data):/i);
    });
  }

  it('escapes raw HTML paragraphs into literal text', () => {
    const result = renderMarkdown('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).not.toContain('<script');
  });

  it('drops links whose protocol is not http, https, mailto or a fragment', () => {
    const result = renderMarkdown('[x](ftp://evil.example.com/file)');
    // The protocol is rejected, so no anchor is produced at all and the source
    // survives only as inert text.
    expect(result.html).not.toContain('<a ');
    expect(result.html).toContain('x');
  });
});

describe('safeHref', () => {
  it('allows http, https, mailto, root-relative and fragment links', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com/');
    expect(safeHref('http://example.com')).toBe('http://example.com/');
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeHref('#section')).toBe('#section');
    expect(safeHref('/episodes')).toBe('/episodes');
  });

  it('rejects script-ish protocols', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,<script>')).toBeNull();
    expect(safeHref('vbscript:x')).toBeNull();
    expect(safeHref('  javascript:alert(1)')).toBeNull();
  });
});

describe('markdownToPlainText', () => {
  it('strips syntax and truncates cleanly', () => {
    const text = markdownToPlainText('# A **bold** heading\n\nSome `code` and [a link](/x).', 200);
    expect(text).toBe('A bold heading Some code and a link.');
    expect(text).not.toContain('#');
    expect(text).not.toContain('**');
  });

  it('adds an ellipsis only when it truncates', () => {
    expect(markdownToPlainText('short', 50)).toBe('short');
    expect(markdownToPlainText('x'.repeat(100), 20)).toMatch(/…$/);
  });
});
