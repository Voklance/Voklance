import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const scryptCost = 32768;
export const dummyPasswordHash = `scrypt$${scryptCost}$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: scryptCost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${scryptCost}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, cost, saltHex, keyHex] = stored.split('$');
  if (
    algorithm !== 'scrypt' ||
    cost !== String(scryptCost) ||
    !/^[0-9a-f]{32}$/.test(saltHex ?? '') ||
    !/^[0-9a-f]{128}$/.test(keyHex ?? '')
  )
    return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await deriveKey(password, Buffer.from(saltHex, 'hex'));
  return timingSafeEqual(actual, expected);
}
