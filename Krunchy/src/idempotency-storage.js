function isMatchingRecord(value, fingerprint, validateKey) {
  return value &&
    value.fingerprint === fingerprint &&
    typeof value.key === "string" &&
    validateKey(value.key);
}

export async function getPersistentIdempotencyKey({
  storageKey,
  payload,
  createKey,
  validateKey,
  rotate = false,
  getStorage = () => window.sessionStorage,
  getCrypto = () => globalThis.crypto
}) {
  let fingerprint;
  try {
    const serialized = JSON.stringify(payload);
    if (typeof serialized !== "string") throw new Error("The request could not be serialized.");
    const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(serialized));
    fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new Error("Secure request recovery is unavailable in this browser.");
  }

  try {
    const storage = getStorage();
    if (!rotate) {
      const saved = storage.getItem(storageKey);
      if (saved) {
        try {
          const record = JSON.parse(saved);
          if (isMatchingRecord(record, fingerprint, validateKey)) return record.key;
        } catch {
          storage.removeItem(storageKey);
        }
      }
    }

    const key = createKey();
    storage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
    return key;
  } catch {
    throw new Error("This browser could not save secure request recovery. Allow session storage and try again.");
  }
}
