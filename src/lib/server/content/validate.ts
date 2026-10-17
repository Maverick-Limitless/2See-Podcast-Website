/**
 * Input validation helpers.
 *
 * Every value crossing from the admin panel into storage passes through here.
 * The rules are narrow on purpose: a value that fails is rejected rather than
 * truncated into something unexpected.
 */

export interface FieldLimit {
  maxLength: number;
  allowEmpty?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationFailure extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(errors.map((error) => `${error.field}: ${error.message}`).join('; '));
    this.name = 'ValidationFailure';
    this.errors = errors;
  }
}

export function requireText(
  value: unknown,
  field: string,
  limit: FieldLimit
): string {
  if (typeof value !== 'string') throw new ValidationFailure([{ field, message: 'Text is required.' }]);
  const trimmed = value.trim();
  if (trimmed === '' && !limit.allowEmpty) {
    throw new ValidationFailure([{ field, message: 'This field cannot be empty.' }]);
  }
  if (trimmed.length > limit.maxLength) {
    throw new ValidationFailure([
      { field, message: `Use at most ${limit.maxLength} characters.` }
    ]);
  }
  return trimmed;
}

export function optionalText(
  value: unknown,
  field: string,
  limit: { maxLength: number }
): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new ValidationFailure([{ field, message: 'Text is required.' }]);
  }
  const trimmed = value.trim();
  if (trimmed.length > limit.maxLength) {
    throw new ValidationFailure([{ field, message: `Use at most ${limit.maxLength} characters.` }]);
  }
  return trimmed;
}

const ABSOLUTE_URL = /^https?:\/\/[^\s]+$/i;

export function requireUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ValidationFailure([{ field, message: 'A URL is required.' }]);
  const trimmed = value.trim();
  if (trimmed === '') throw new ValidationFailure([{ field, message: 'A URL is required.' }]);
  if (trimmed.length > 2048) {
    throw new ValidationFailure([{ field, message: 'The URL is too long.' }]);
  }
  if (!ABSOLUTE_URL.test(trimmed)) {
    throw new ValidationFailure([{ field, message: 'Use an http:// or https:// URL.' }]);
  }
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return trimmed;
  } catch {
    throw new ValidationFailure([{ field, message: 'That URL could not be read.' }]);
  }
}

export function optionalUrl(value: unknown, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.trim() === '') return '';
  return requireUrl(value, field);
}

/** Accepts youtube.com, youtu.be and i.ytimg.com hosts for images. */
export function optionalImageUrl(value: unknown, field: string): string {
  if (value === undefined || value === null) return '';
  const url = requireUrl(value, field);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationFailure([{ field, message: 'That URL could not be read.' }]);
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === 'i.ytimg.com' ||
    host === 'img.youtube.com' ||
    host === 'yt3.ggpht.com' ||
    host === 'yt3.googleusercontent.com' ||
    host === 'yt4.ggpht.com';
  if (!allowed) {
    throw new ValidationFailure([
      { field, message: 'Image URLs must be YouTube-hosted thumbnails.' }
    ]);
  }
  return parsed.toString();
}

export function requireState(value: unknown, field: string): 'draft' | 'published' {
  if (value === 'published' || value === 'draft') return value;
  throw new ValidationFailure([{ field, message: 'Choose draft or published.' }]);
}

export function requireBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === '') return false;
  throw new ValidationFailure([{ field: 'featured', message: 'Choose yes or no.' }]);
}

export function requirePositiveInt(value: unknown, field: string, max = 86399): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ValidationFailure([{ field, message: 'Enter a number of seconds.' }]);
  }
  return parsed;
}

export function requireOptionalInt(value: unknown, field: string, max = 2147483647): number | null {
  if (value === undefined || value === null || value === '') return null;
  return requirePositiveInt(value, field, max);
}

/** Publication date. Empty means "not set"; the value is normalised to UTC. */
export function requireDate(value: unknown, field: string, allowEmpty = true): string | null {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return null;
    throw new ValidationFailure([{ field, message: 'A date is required.' }]);
  }
  if (typeof value !== 'string') throw new ValidationFailure([{ field, message: 'A date is required.' }]);
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new ValidationFailure([{ field, message: 'Enter a valid date.' }]);
  }
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
