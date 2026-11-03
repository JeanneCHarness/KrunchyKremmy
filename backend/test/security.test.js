import assert from "node:assert/strict";
import test from "node:test";
import {
  createDatabaseRateLimiter,
  nextLoginFailureState
} from "../src/security.js";

test("account lockout begins on the fifth failure and expires after fifteen minutes", () => {
  const start = new Date("2026-11-03T08:00:00.000Z");
  let state = {
    failedLoginAttempts: 0,
    loginFailureWindowStartedAt: null,
    loginLockedUntil: null
  };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = nextLoginFailureState(state, new Date(start.getTime() + attempt * 1000));
    assert.equal(state.failedLoginAttempts, attempt);
  }
  assert.equal(state.loginLockedUntil.getTime(), start.getTime() + 5_000 + 15 * 60 * 1000);
  assert.equal(nextLoginFailureState(state, new Date(start.getTime() + 60_000)).locked, true);

  const unlocked = nextLoginFailureState(state, state.loginLockedUntil);
  assert.equal(unlocked.locked, false);
  assert.equal(unlocked.failedLoginAttempts, 1);
  assert.equal(unlocked.loginLockedUntil, null);
});

test("expired failure windows restart the consecutive-attempt counter", () => {
  const start = new Date("2026-11-03T08:00:00.000Z");
  const state = nextLoginFailureState({
    failedLoginAttempts: 4,
    loginFailureWindowStartedAt: start,
    loginLockedUntil: null
  }, new Date(start.getTime() + 15 * 60 * 1000));
  assert.equal(state.failedLoginAttempts, 1);
  assert.equal(state.loginFailureWindowStartedAt.getTime(), start.getTime() + 15 * 60 * 1000);
});

test("database IP limiter allows ten requests, blocks the eleventh, and records the block once", async () => {
  const buckets = new Map();
  const events = [];
  const prisma = {
    async $queryRaw(_query, bucketId, resetAt, now) {
      let bucket = buckets.get(bucketId);
      if (!bucket || bucket.resetAt <= now) bucket = { hits: 0, resetAt };
      bucket.hits += 1;
      buckets.set(bucketId, bucket);
      return [{ ...bucket }];
    },
    securityEvent: {
      async create({ data }) {
        events.push(data);
      }
    }
  };
  const middleware = createDatabaseRateLimiter(prisma, {
    scope: "login",
    limit: 10,
    message: "Too many sign-in attempts."
  });
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let passed = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const request = { ip: "192.0.2.9", socket: {} };
    await middleware(request, response, () => { passed += 1; });
  }
  assert.equal(passed, 10);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.error, "Too many sign-in attempts.");
  assert.ok(Number(response.headers["Retry-After"]) > 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "IP_RATE_LIMITED");
  assert.equal(events[0].ipHash.length, 64);
});
