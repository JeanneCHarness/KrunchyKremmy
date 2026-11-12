import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { getPersistentIdempotencyKey } from "../src/idempotency-storage.js";

function createStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key)
  };
}

const isValidKey = (key) => /^key-[0-9]+$/.test(key);

test("request keys are reused only for the same payload and can be rotated", async () => {
  const storage = createStorage();
  let sequence = 0;
  const createKey = () => `key-${++sequence}`;
  const getKey = (payload, options = {}) => getPersistentIdempotencyKey({
    storageKey: "test",
    payload,
    createKey,
    validateKey: isValidKey,
    getStorage: () => storage,
    getCrypto: () => webcrypto,
    ...options
  });

  assert.equal(await getKey({ amount: 125 }), "key-1");
  assert.equal(await getKey({ amount: 125 }), "key-1");
  assert.equal(await getKey({ amount: 130 }), "key-2");
  assert.equal(await getKey({ amount: 130 }, { rotate: true }), "key-3");
});

test("request recovery reports blocked session storage", async () => {
  await assert.rejects(
    getPersistentIdempotencyKey({
      storageKey: "test",
      payload: { amount: 125 },
      createKey: () => "key-1",
      validateKey: isValidKey,
      getStorage: () => { throw new Error("blocked"); },
      getCrypto: () => webcrypto
    }),
    /could not save secure request recovery/
  );
});
