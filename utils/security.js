/** Cryptographic and identifier helpers. */
const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 150_000;

const getCrypto = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || !cryptoApi?.getRandomValues) throw new Error('Web Crypto API is unavailable');
  return cryptoApi;
};

const toBase64 = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return globalThis.btoa ? globalThis.btoa(binary) : Buffer.from(bytes).toString('base64');
};

const fromBase64 = (value) => {
  const binary = globalThis.atob ? globalThis.atob(value) : Buffer.from(value, 'base64').toString('binary');
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const randomBytes = (length) => {
  const output = new Uint8Array(length);
  getCrypto().getRandomValues(output);
  return output;
};

const SECRET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates an opaque, human-readable token using Web Crypto.  The alphabet
 * deliberately omits visually ambiguous characters (0/O and 1/I/L).
 *
 * This function provides unpredictable tokens; uniqueness is additionally
 * enforced by the caller when a token is persisted.
 */
export const generateSecretToken = (prefix = 'HUD', length = 12) => {
  const cleanPrefix = String(prefix).replace(/[^A-Z0-9_-]/giu, '').toUpperCase() || 'HUD';
  const safeLength = Math.min(64, Math.max(8, Math.floor(Number(length) || 12)));
  const bytes = randomBytes(safeLength);
  const randomPart = Array.from(bytes, (byte) => SECRET_ALPHABET[byte % SECRET_ALPHABET.length]).join('');
  return `${cleanPrefix}-${randomPart}`;
};

/** Manager-only reference assigned to an account document. */
export const generateAccountSecret = () => generateSecretToken('ACC', 12);

/** Manager-only reference assigned to an offer document. */
export const generateOfferSecret = () => generateSecretToken('OFF', 12);

/** Backward-compatible longer token used by device/admin-gate helpers. */
export const generateUniqueSecretToken = (prefix = 'HUD') => {
  const cleanPrefix = String(prefix).replace(/[^A-Z0-9_-]/giu, '').toUpperCase() || 'HUD';
  const bytes = randomBytes(20);
  const randomPart = Array.from(bytes, (byte) => SECRET_ALPHABET[byte % SECRET_ALPHABET.length]).join('');
  return `${cleanPrefix}-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
};

export const generateWhatsAppVerificationCode = () => {
  const value = new Uint32Array(1);
  getCrypto().getRandomValues(value);
  return String(100000 + (value[0] % 900000));
};

export const generateDeviceId = () => {
  const key = 'hud_device_id';
  try {
    const stored = globalThis.localStorage?.getItem(key);
    if (stored) return stored;
  } catch { /* storage may be unavailable */ }

  const navigatorInfo = globalThis.navigator || {};
  const screenInfo = globalThis.screen || {};
  const fingerprint = [
    navigatorInfo.userAgent, navigatorInfo.language, navigatorInfo.platform,
    navigatorInfo.hardwareConcurrency, navigatorInfo.maxTouchPoints,
    screenInfo.width, screenInfo.height, screenInfo.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');
  let hash = 2166136261;
  for (const character of fingerprint) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const entropy = Array.from(randomBytes(4), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const id = `DEV-${(hash >>> 0).toString(36).toUpperCase()}-${entropy.toUpperCase()}`;
  try { globalThis.localStorage?.setItem(key, id); } catch { /* no-op */ }
  return id;
};

export const hashPassword = async (password, options = {}) => {
  const { iterations = PBKDF2_ITERATIONS, salt = randomBytes(16) } = options;
  if (!String(password ?? '')) throw new Error('Password is required');
  try {
    const cryptoApi = getCrypto();
    const key = await cryptoApi.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const bits = await cryptoApi.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
    );
    return `pbkdf2-sha256$${iterations}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
  } catch (error) {
    console.error('[security] hashPassword failed', error);
    throw error;
  }
};

export const verifyPassword = async (password, encodedHash) => {
  try {
    const [algorithm, iterationsText, saltText, expectedText] = String(encodedHash ?? '').split('$');
    if (algorithm !== 'pbkdf2-sha256' || !iterationsText || !saltText || !expectedText) return false;
    const actual = await hashPassword(password, { iterations: Number(iterationsText), salt: fromBase64(saltText) });
    const actualBytes = encoder.encode(actual);
    const expectedBytes = encoder.encode(String(encodedHash));
    if (actualBytes.length !== expectedBytes.length) return false;
    let difference = 0;
    actualBytes.forEach((byte, index) => { difference |= byte ^ expectedBytes[index]; });
    return difference === 0;
  } catch (error) {
    console.warn('[security] verifyPassword failed', error);
    return false;
  }
};

export default Object.freeze({
  generateSecretToken,
  generateAccountSecret,
  generateOfferSecret,
  generateUniqueSecretToken,
  generateDeviceId,
  generateWhatsAppVerificationCode,
  hashPassword,
  verifyPassword
});
