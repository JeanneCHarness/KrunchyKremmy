import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCookie,
  createOpaqueToken,
  hashPassword,
  hashToken,
  publicUser,
  readSessionCookie,
  sessionCookie,
  verifyPassword
} from "../src/auth.js";

test("password hashes are salted and verify only the original password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("not the password", first), false);
});

test("session tokens are opaque and cookies are HttpOnly and SameSite", () => {
  const token = createOpaqueToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,50}$/);
  assert.match(hashToken(token), /^[a-f0-9]{64}$/);
  assert.equal(readSessionCookie(`other=x; kk_session=${token}`), token);
  assert.match(sessionCookie(token, { secure: true }), /HttpOnly; SameSite=Lax; Path=\/;.*Secure/);
  assert.match(clearSessionCookie(true), /Max-Age=0; Secure/);
});

test("public user projection excludes credentials and private fields", () => {
  const user = publicUser({
    id: "user-1",
    email: "customer@example.com",
    name: "Customer",
    role: "CUSTOMER",
    emailVerifiedAt: new Date(),
    passwordHash: "secret",
    createdAt: new Date()
  });
  assert.deepEqual(Object.keys(user).sort(), ["email", "emailVerified", "id", "name", "role"]);
});
