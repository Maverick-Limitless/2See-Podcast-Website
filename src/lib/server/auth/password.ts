import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing using scrypt from Node's built-in crypto module.
 *
 * scrypt is a memory-hard KDF that ships inside Node itself, so there is no
 * third-party hashing dependency to audit, pin or keep patched. Parameters
 * follow the OWASP-described range for scrypt: N=32768, r=8, p=1 — well above
 * "interactive" strength while still fast enough for a single-user login form.
 *
 * The salt and hash are stored in separate columns and the parameters are kept
 * alongside them, so a parameter change can be detected and the credential
 * upgraded on the next successful login.
 */

export interface HashParams {
  N: number;
  r: number;
  p: number;
  keyLength: number;
}

export const DEFAULT_PARAMS: HashParams = { N: 32768, r: 8, p: 1, keyLength: 64 };

export function randomSalt(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Cryptographically secure random password with no bias in class composition:
 * one character from each class, then random filler, then a shuffle.
 */
export function generateRandomPassword(length = 24): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const alphabet = upper + lower + digits + symbols;

  const chars: string[] = [
    upper[randomInt(0, upper.length)]!,
    lower[randomInt(0, lower.length)]!,
    digits[randomInt(0, digits.length)]!,
    symbols[randomInt(0, symbols.length)]!
  ];
  while (chars.length < length) {
    chars.push(alphabet[randomInt(0, alphabet.length)]!);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

export function hashPassword(
  password: string,
  salt: string,
  params: HashParams = DEFAULT_PARAMS
): string {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }
  const derived = scryptSync(password, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * 1024 * 1024
  });
  return derived.toString('hex');
}

export function serializeParams(params: HashParams): string {
  return `scrypt$${params.N}$${params.r}$${params.p}$${params.keyLength}`;
}

export function parseParams(serialized: string): HashParams {
  const parts = serialized.split('$');
  if (parts.length !== 5 || parts[0] !== 'scrypt') {
    throw new Error('Unrecognised hash parameters.');
  }
  const parsed = {
    N: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
    keyLength: Number(parts[4])
  };
  const valid =
    Number.isInteger(parsed.N) &&
    parsed.N > 1 &&
    Number.isInteger(parsed.r) &&
    parsed.r > 0 &&
    Number.isInteger(parsed.p) &&
    parsed.p > 0 &&
    Number.isInteger(parsed.keyLength) &&
    parsed.keyLength >= 16;
  if (!valid) throw new Error('Unrecognised hash parameters.');
  return parsed;
}

export interface StoredCredential {
  hash: string;
  salt: string;
  params: string;
}

/** Constant-time comparison that never reveals where a mismatch occurred. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function verifyPassword(password: string, stored: StoredCredential): boolean {
  let params: HashParams;
  try {
    params = parseParams(stored.params);
  } catch {
    return false;
  }
  try {
    const computed = hashPassword(password, stored.salt, params);
    return safeEqualHex(computed, stored.hash);
  } catch {
    return false;
  }
}

/**
 * Always runs a hash even when the account does not exist, so a login attempt
 * against a missing account costs the same time as one against a real account.
 */
export function burnHashCost(password: string): void {
  hashPassword(password, '0'.repeat(32));
}
