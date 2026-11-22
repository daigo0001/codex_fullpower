export const PBKDF2_ITERATIONS = 600_000;
export const MAX_PASSWORD_BYTES = 1_024;
export const MAX_MESSAGE_BYTES = 4_096;

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function encodeText(text, label, maximum) {
  if (typeof text !== "string") {
    throw new TypeError(`${label}を文字列で入力してください。`);
  }
  const bytes = text.length <= maximum ? encoder.encode(text) : null;
  if (bytes === null || bytes.length > maximum) {
    throw new RangeError(`${label}は UTF-8 で ${maximum.toLocaleString("ja-JP")} バイト以内にしてください。`);
  }
  return bytes;
}

function encodePassword(text) {
  const bytes = encodeText(text, "パスワード", MAX_PASSWORD_BYTES);
  if (bytes.length === 0) throw new RangeError("パスワードを入力してください。");
  return bytes;
}

function randomBytes(size) {
  return globalThis.crypto.getRandomValues(new Uint8Array(size));
}

function hasLength(value, length) {
  return value instanceof Uint8Array && value.length === length;
}

async function deriveHash(password, salt) {
  const { subtle } = globalThis.crypto;
  const key = await subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt,
  }, key, HASH_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(text) {
  const password = encodePassword(text);
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveHash(password, salt);
  return { salt, hash };
}

export async function verifyPassword(text, record) {
  const password = encodePassword(text);
  if (!hasLength(record?.salt, SALT_BYTES) || !hasLength(record?.hash, HASH_BYTES)) {
    throw new TypeError("ハッシュのレコードが正しくありません。");
  }

  const storedHash = record.hash.slice();
  const candidateHash = await deriveHash(password, record.salt.slice());
  // Compare every byte of the fixed-length output, without early exit on a difference.
  let difference = 0;
  for (let index = 0; index < HASH_BYTES; index += 1) {
    difference |= candidateHash[index] ^ storedHash[index];
  }
  return difference === 0;
}

export async function createDemoKey() {
  return globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(text, key) {
  const bytes = encodeText(text, "平文", MAX_MESSAGE_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: TAG_BYTES * 8 },
    key,
    bytes,
  ));
  const tagOffset = encrypted.length - TAG_BYTES;
  return { nonce, ciphertext: encrypted.slice(0, tagOffset), tag: encrypted.slice(tagOffset) };
}

export async function decryptMessage(record, key) {
  const { nonce, ciphertext, tag } = record ?? {};
  if (!hasLength(nonce, NONCE_BYTES) || !hasLength(tag, TAG_BYTES) ||
      !(ciphertext instanceof Uint8Array) || ciphertext.length > MAX_MESSAGE_BYTES) {
    throw new TypeError("暗号化のレコードが正しくありません。");
  }

  // Web Crypto's API expects the ciphertext followed by the authentication tag.
  const encrypted = new Uint8Array(ciphertext.length + TAG_BYTES);
  encrypted.set(ciphertext);
  encrypted.set(tag, ciphertext.length);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: TAG_BYTES * 8 },
    key,
    encrypted,
  );
  return decoder.decode(plaintext);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
