import { createHmac, randomBytes } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;
const hashKey = process.env.SECURITY_HASH_KEY ||
  (process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("hex"));

if (Buffer.byteLength(hashKey) < 32) {
  throw new Error("SECURITY_HASH_KEY must contain at least 32 bytes.");
}

export function hashSecurityIdentifier(value) {
  return createHmac("sha256", hashKey).update(value).digest("hex");
}

export function nextLoginFailureState(user, now = new Date()) {
  if (user.loginLockedUntil && user.loginLockedUntil > now) {
    return { locked: true, failedLoginAttempts: user.failedLoginAttempts };
  }

  const windowExpired = !user.loginFailureWindowStartedAt ||
    user.loginFailureWindowStartedAt.getTime() <= now.getTime() - WINDOW_MS ||
    (user.loginLockedUntil && user.loginLockedUntil <= now);
  const failedLoginAttempts = windowExpired ? 1 : user.failedLoginAttempts + 1;
  return {
    locked: false,
    failedLoginAttempts,
    loginFailureWindowStartedAt: windowExpired ? now : user.loginFailureWindowStartedAt,
    loginLockedUntil: failedLoginAttempts >= LOCKOUT_THRESHOLD
      ? new Date(now.getTime() + WINDOW_MS)
      : null
  };
}

export function createDatabaseRateLimiter(prisma, { scope, limit, message }) {
  return async (request, response, next) => {
    try {
      const now = new Date();
      const resetAt = new Date(now.getTime() + WINDOW_MS);
      const clientIp = request.ip || request.socket?.remoteAddress || "unknown";
      const bucketId = `${scope}:${hashSecurityIdentifier(clientIp)}`;
      const [bucket] = await prisma.$queryRaw`
        INSERT INTO "AuthRateLimitBucket" ("id", "hits", "resetAt", "createdAt", "updatedAt")
        VALUES (${bucketId}, 1, ${resetAt}, ${now}, ${now})
        ON CONFLICT ("id") DO UPDATE SET
          "hits" = CASE
            WHEN "AuthRateLimitBucket"."resetAt" <= ${now} THEN 1
            ELSE "AuthRateLimitBucket"."hits" + 1
          END,
          "resetAt" = CASE
            WHEN "AuthRateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
            ELSE "AuthRateLimitBucket"."resetAt"
          END,
          "updatedAt" = ${now}
        RETURNING "hits", "resetAt"
      `;
      const remaining = Math.max(0, limit - bucket.hits);
      response.setHeader("RateLimit-Limit", String(limit));
      response.setHeader("RateLimit-Remaining", String(remaining));
      response.setHeader("RateLimit-Reset", String(Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)));
      if (bucket.hits > limit) {
        if (bucket.hits === limit + 1) {
          await prisma.securityEvent.create({
            data: { type: "IP_RATE_LIMITED", ipHash: hashSecurityIdentifier(clientIp) }
          });
        }
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000))));
        return response.status(429).json({ error: message });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function cleanupSecurityData(prisma, now = new Date()) {
  const [buckets, events] = await Promise.all([
    prisma.authRateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } }),
    prisma.securityEvent.deleteMany({
      where: { createdAt: { lte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } }
    })
  ]);
  return { buckets: buckets.count, events: events.count };
}
