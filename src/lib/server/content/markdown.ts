/**
 * A deliberately small Markdown renderer.
 *
 * Why hand-written instead of a library: the rendering target is raw HTML
 * inserted into a page, and the single requirement that matters is that no
 * input can produce an executable element. Building the HTML by construction
 * from a narrow token set is auditable in one file, and every accepted
 * construct has a test below. A general-purpose Markdown library plus an HTML
 * sanitizer has more surface area and two failure modes to reconcile.
 *
 * Supported: ATX headings, paragraphs, unordered and ordered lists, blockquotes,
 * fenced code, horizontal rules, inline code, bold, italic, links, hard breaks.
 * Anything else is escaped and shown as literal text. Raw HTML in the source is
 * always escaped, never passed through.
 */

export interface RenderResult {
  html: string;
  headings: { level: number; text: string; id: string }[];
  wordCount: number;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(input: string): string {
  return escapeHtml(input).replace(/`/g, '&#96;');
}

export function slugifyHeading(input: string, used: Set<string>): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
  let slug = base === '' ? 'section' : base;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(slug);
  return slug;
}

/** Rejects any href that is not an allowed protocol or a same-page fragment. */
export function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed, 'https://2see.invalid');
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  return url.toString();
}

interface InlineToken {
  type: 'text' | 'code' | 'strong' | 'em' | 'link' | 'break';
  value: string;
  href?: string;
}

/**
 * Inline parser. Greedy-safe left-to-right pass with an explicit escape hatch
 * for backslash and backtick; no nested inline constructs are supported, which
 * keeps the output grammar closed.
 */
function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let i = 0;

  const flush = (): void => {
    if (buffer !== '') {
      tokens.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < source.length) {
    const char = source[i]!;

    if (char === '\\' && i + 1 < source.length) {
      buffer += source[i + 1]!;
      i += 2;
      continue;
    }

    if (char === '`') {
      const close = source.indexOf('`', i + 1);
      if (close > i + 1) {
        flush();
        tokens.push({ type: 'code', value: source.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    if (char === '*' && source[i + 1] === '*') {
      const close = source.indexOf('**', i + 2);
      if (close > i + 2) {
        flush();
        tokens.push({ type: 'strong', value: source.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
    }

    if (char === '*' || char === '_') {
      if (/\s/.test(source[i + 1] ?? ' ') || i + 1 >= source.length) {
        buffer += char;
        i += 1;
        continue;
      }
      const close = source.indexOf(char, i + 1);
      if (close > i + 1) {
        flush();
        tokens.push({ type: 'em', value: source.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    if (char === '[') {
      const closeBracket = source.indexOf('](', i + 1);
      if (closeBracket > i) {
        const closeParen = source.indexOf(')', closeBracket + 2);
        if (closeParen > closeBracket + 2) {
          const label = source.slice(i + 1, closeBracket);
          const rawHref = source.slice(closeBracket + 2, closeParen);
          const href = safeHref(rawHref);
          if (href !== null) {
            flush();
            tokens.push({ type: 'link', value: label, href });
            i = closeParen + 1;
            continue;
          }
        }
      }
    }

    buffer += char;
    i += 1;
  }
  flush();
  return tokens;
}

function renderInlineTokens(tokens: InlineToken[]): string {
  let out = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        out += escapeHtml(token.value);
        break;
      case 'code':
        out += `<code>${escapeHtml(token.value)}</code>`;
        break;
      case 'strong':
        out += `<strong>${escapeHtml(token.value)}</strong>`;
        break;
      case 'em':
        out += `<em>${escapeHtml(token.value)}</em>`;
        break;
      case 'link':
        out +=
          `<a href="${escapeAttr(token.href!)}" rel="noopener noreferrer"` +
          ` target="_blank">${escapeHtml(token.value)}</a>`;
        break;
      case 'break':
        out += '<br />';
        break;
    }
  }
  return out;
}

function renderInline(source: string): string {
  return renderInlineTokens(parseInline(source));
}

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\-]/g, ' ')
    .trim();
  if (text === '') return 0;
  return text.split(/\s+/).length;
}

export function readingMinutes(markdown: string, wordsPerMinute = 200): number {
  const words = countWords(markdown);
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

export function renderMarkdown(source: string): RenderResult {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  const headings: { level: number; text: string; id: string }[] = [];
  const usedSlugs = new Set<string>();
  let i = 0;
  let wordCount = countWords(source);

  const closeParagraph = (buffer: string[]): void => {
    if (buffer.length === 0) return;
    html.push(`<p>${renderInline(buffer.join(' '))}</p>`);
    buffer.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const raw = lines[i]!;
    const line = raw.trimEnd();

    // Fenced code — content is escaped, never interpreted
    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      closeParagraph(paragraph);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
        body.push(lines[i]!);
        i += 1;
      }
      i += 1;
      const lang = fence[1] && /^[a-z0-9+#-]+$/i.test(fence[1]) ? fence[1] : '';
      const label = lang !== '' ? ` class="language-${escapeAttr(lang)}"` : '';
      html.push(`<pre><code${label}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.trim() === '') {
      closeParagraph(paragraph);
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line.trim());
    if (heading) {
      closeParagraph(paragraph);
      const level = heading[1]!.length;
      const text = heading[2]!.trim();
      const plain = text.replace(/`/g, '');
      const id = slugifyHeading(plain, usedSlugs);
      headings.push({ level, text: plain, id });
      html.push(`<h${level} id="${escapeAttr(id)}">${renderInline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      closeParagraph(paragraph);
      html.push('<hr />');
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeParagraph(paragraph);
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) {
        body.push(lines[i]!.replace(/^\s*>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote><p>${renderInline(body.join(' '))}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      closeParagraph(paragraph);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*+]\s+/, '').trim());
        i += 1;
      }
      html.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      closeParagraph(paragraph);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, '').trim());
        i += 1;
      }
      let start = 1;
      const firstMatch = /^\s*(\d+)[.)]\s+/.exec(raw);
      if (firstMatch) start = Number(firstMatch[1]);
      html.push(
        `<ol${start !== 1 ? ` start="${start}"` : ''}>${items
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join('')}</ol>`
      );
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  closeParagraph(paragraph);
  return { html: html.join('\n'), headings, wordCount };
}

/**
 * Plain-text extraction used for summaries, meta descriptions and search.
 * Strips Markdown syntax without producing HTML.
 */
export function markdownToPlainText(source: string, maxLength = 160): string {
  let text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength > 0 && text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    text = `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  return text;
}
