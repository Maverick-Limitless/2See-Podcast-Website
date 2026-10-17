/** Shared text helpers used by both content types. */

const SLUG_INVALID = /[^a-z0-9]+/g;
const SLUG_EDGE = /^-+|-+$/g;

export function slugify(input: string, fallback = 'item'): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
    .replace(SLUG_EDGE, '')
    .slice(0, 80);
  return base === '' ? fallback : base;
}

/**
 * Makes a slug unique against the supplied set without introducing collisions:
 * Persian titles and Latin titles can slugify to the same ASCII string, so the
 * suffix is applied deterministically.
 */
export function dedupeSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let counter = 2;
  while (taken.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  taken.add(slug);
  return slug;
}

/** True for strings containing Arabic-script (including Persian) characters. */
export function hasPersian(input: string): boolean {
  return /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/.test(input);
}

export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  const cut = input.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .slice(0, 24);
}

export function joinList(values: string[]): string {
  return values.filter((value) => value.trim() !== '').join(', ');
}
