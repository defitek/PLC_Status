import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const validPassword = password => typeof password === 'string' && password.length >= 8 && password.length <= 256;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  try {
    const [salt, expectedHex] = storedHash.split(':');
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
