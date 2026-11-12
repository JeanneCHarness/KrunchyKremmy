import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./db.js";
import { clearSessionCookie, createOpaqueToken, hashPassword, hashToken, publicUser, readSessionCookie, sessionCookie, verifyPassword } from "./auth.js";
import { escapeHtml, sendTransactionalEmail } from "./email.js";
import { builderSelectionSchema, quoteBuilder } from "./pricing.js";
import { priceProductSelection } from "./catalog-customization.js";
import {
  createPaymentReference,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhook
} from "./payments.js";
import { bookingRequestHash, bookingSchema, validateBookingTime, validateServiceCustomization } from "./event-bookings.js";
import { createAdminRouter } from "./admin-routes.js";
import { generateScheduleSlots, localDateTimeToUtc } from "./fulfillment.js";
import { sendOrderNotification } from "./order-notifications.js";
import { createDatabaseRateLimiter, hashSecurityIdentifier, nextLoginFailureState } from "./security.js";

const app = express();
app.disable("x-powered-by");
const trustedProxyCidrs = (process.env.TRUSTED_PROXY_CIDRS || "").split(",").map((value) => value.trim()).filter(Boolean);
app.set("trust proxy", trustedProxyCidrs.length ? trustedProxyCidrs : false);
app.use(helmet());
app.use((_request, response, next) => {
  for (const header of ["Server", "X-Powered-By", "X-AspNet-Version", "X-AspNetMvc-Version", "X-Runtime"]) {
    response.removeHeader(header);
  }
  next();
});
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));

async function settleOrderByReference(reference, transactionData) {
  if (transactionData.status !== "success") return;
  const attempt = await prisma.paymentAttempt.findUnique({ where: { reference }, include: { order: true } });
  const order = attempt?.order || await prisma.order.findUnique({ where: { paymentReference: reference }, include: { items: true } });
  if (!order) {
    const error = new Error("Payment reference is not associated with an order.");
    error.status = 409;
    throw error;
  }
  const amountKobo = attempt?.amountKobo ?? order.totalCents ?? order.subtotalCents;
  if (
    transactionData.reference !== reference ||
    transactionData.metadata?.orderId !== order.id ||
    transactionData.amount !== amountKobo ||
    !Number.isInteger(transactionData.id) ||
    transactionData.currency?.toLowerCase() !== order.currency.toLowerCase()
  ) {
    console.error("Paystack payment verification mismatch for order:", order.orderNumber);
    const error = new Error("Payment details do not match this order.");
    error.status = 409;
    throw error;
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const current = await transaction.order.findUnique({ where: { id: order.id }, include: { items: true } });
    if (!current) return;
    const alreadyPaid = current.paymentStatus === "PAID";
    const reservationExpired = Boolean(current.fulfillmentMethod) && (
      current.paymentReference !== reference ||
      !current.reservationActive ||
      !current.reservationExpiresAt ||
      current.reservationExpiresAt <= new Date()
    );
    if (!alreadyPaid) {
      if (current.reservationActive && (reservationExpired || current.reservationExpiresAt <= new Date())) {
        await releaseOrderResources(transaction, current);
      }
      const toStatus = reservationExpired ? "PAYMENT_REVIEW" : "CONFIRMED";
      await transaction.order.update({
        where: { id: current.id },
        data: {
          paymentStatus: "PAID",
          status: toStatus,
          reservationActive: false,
          providerTransactionId: String(transactionData.id)
        }
      });
      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: current.status,
          toStatus,
          actorId: "paystack",
          reason: reservationExpired
            ? "Paystack confirmed payment after the fulfilment reservation expired; manual reconciliation is required."
            : "Payment verified with Paystack."
        }
      });
    }
    if (attempt) {
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PAID",
          providerTransactionId: String(transactionData.id),
          verifiedAt: new Date(),
          reconciliationRequired: (!alreadyPaid && reservationExpired) ||
            (alreadyPaid && current.providerTransactionId !== String(transactionData.id))
        }
      });
      await transaction.paymentAttempt.updateMany({
        where: { orderId: order.id, id: { not: attempt.id }, status: "PENDING" },
        data: { status: "FAILED" }
      });
    }
  });
  await sendOrderNotification(prisma, order.id, "PAYMENT_CONFIRMED");
}

async function releaseOrderByReference(reference, transactionData) {
  const attempt = await prisma.paymentAttempt.findUnique({ where: { reference }, include: { order: { include: { items: true } } } });
  const order = attempt?.order || await prisma.order.findUnique({ where: { paymentReference: reference }, include: { items: true } });
  if (!order || transactionData.status !== "failed") return;
  if (
    transactionData.reference !== reference ||
    transactionData.metadata?.orderId !== order.id ||
    transactionData.amount !== (attempt?.amountKobo ?? order.totalCents ?? order.subtotalCents) ||
    transactionData.currency?.toLowerCase() !== order.currency.toLowerCase()
  ) {
    console.error("Paystack failed transaction mismatch for order:", order.orderNumber);
    const error = new Error("Payment details do not match this order.");
    error.status = 409;
    throw error;
  }
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING", paymentReference: reference },
      data: { paymentStatus: "FAILED", status: "CANCELLED", reservationActive: false }
    });
    if (attempt) {
      await transaction.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "FAILED", reconciliationRequired: false, verifiedAt: new Date() }
      });
    }
    if (updated.count !== 1) return;
    await transaction.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED", actorId: "paystack", reason: "Paystack transaction failed." }
    });
    await releaseOrderResources(transaction, order);
  });
}

async function releaseOrderResources(transaction, order) {
  for (const item of order.items || []) {
    if (item.productId) {
      await transaction.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }
    const customization = item.customization;
    if (customization && typeof customization === "object" && Array.isArray(customization.optionIds)) {
      for (const optionId of customization.optionIds) {
        await transaction.builderOption.update({ where: { id: optionId }, data: { stock: { increment: item.quantity } } });
      }
    }
  }
  if (order.reservationActive && order.scheduleSlotId) {
    await transaction.fulfillmentSlot.updateMany({
      where: { id: order.scheduleSlotId, reservedCount: { gt: 0 } },
      data: { reservedCount: { decrement: 1 } }
    });
  }
}

async function initializeOrderPayment(order, origin) {
  if (order.providerSessionId || order.providerTransactionId) {
    const error = new Error("This order has an unresolved previous payment. Please contact the shop before retrying.");
    error.status = 409;
    throw error;
  }
  if (order.paymentReference && order.paymentAuthorizationUrl) {
    return { reference: order.paymentReference, authorizationUrl: order.paymentAuthorizationUrl };
  }
  if (order.paymentReference) {
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { reference: order.paymentReference },
      select: { reconciliationRequired: true }
    });
    const error = new Error(attempt?.reconciliationRequired
      ? `We could not confirm whether Paystack started payment for order ${order.orderNumber}. Do not start another payment until this one is verified.`
      : "Payment is already being prepared. Please retry in a moment.");
    error.status = attempt?.reconciliationRequired ? 503 : 409;
    error.expose = Boolean(attempt?.reconciliationRequired);
    throw error;
  }
  const reference = createPaymentReference();
  const reservedReference = await prisma.order.updateMany({
    where: {
      id: order.id,
      paymentStatus: "PENDING",
      paymentReference: null
    },
    data: { paymentReference: reference, paymentAuthorizationUrl: null }
  });
  if (reservedReference.count !== 1) {
    const current = await prisma.order.findUnique({
      where: { id: order.id },
      select: { paymentStatus: true, paymentReference: true, paymentAuthorizationUrl: true }
    });
    if (current?.paymentStatus === "PENDING" && current.paymentReference && current.paymentAuthorizationUrl) {
      return { reference: current.paymentReference, authorizationUrl: current.paymentAuthorizationUrl };
    }
    const error = new Error(current?.paymentStatus === "PENDING"
      ? "Payment is already being prepared. Please retry in a moment."
      : "This order is no longer available for payment.");
    error.status = 409;
    throw error;
  }
  const amountKobo = order.totalCents ?? order.subtotalCents;
  const attempt = await prisma.paymentAttempt.create({
    data: {
      orderId: order.id,
      reference,
      amountKobo,
      currency: order.currency
    }
  });
  let payment;
  try {
    payment = await initializePaystackTransaction({ ...order, totalCents: amountKobo, currency: order.currency }, origin, reference);
  } catch (error) {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: error.outcomeUnknown ? "PENDING" : "FAILED",
        reconciliationRequired: Boolean(error.outcomeUnknown)
      }
    });
    if (error.outcomeUnknown) {
      error.status = 503;
      error.expose = true;
      error.message = `We could not confirm whether Paystack started payment for order ${order.orderNumber}. Do not start another payment until this one is verified.`;
    }
    throw error;
  }
  const saved = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PENDING", paymentReference: reference },
    data: { paymentAuthorizationUrl: payment.authorizationUrl }
  });
  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { authorizationUrl: payment.authorizationUrl }
  });
  if (saved.count !== 1) {
    const error = new Error("The payment link could not be saved. Please contact the shop before retrying.");
    error.status = 503;
    throw error;
  }
  return payment;
}

app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "256kb" }), async (request, response, next) => {
  try {
    const event = verifyPaystackWebhook(request.body, request.headers["x-paystack-signature"]);
    const reference = event.data?.reference;
    if (event.event === "charge.success" || event.event === "charge.failed") {
      if (typeof reference !== "string" || !/^KK-[a-f0-9]{36}$/i.test(reference)) {
        return response.status(400).json({ error: "Invalid Paystack transaction reference." });
      }
      const verified = await verifyPaystackTransaction(reference);
      if (event.event === "charge.success" && verified.status !== "success") {
        const error = new Error("Paystack has not yet verified the successful charge.");
        error.status = 503;
        throw error;
      }
      if (event.event === "charge.failed" && verified.status !== "failed") {
        const error = new Error("Paystack has not yet verified the failed charge.");
        error.status = 503;
        throw error;
      }
      if (event.event === "charge.success") await settleOrderByReference(reference, verified);
      else await releaseOrderByReference(reference, verified);
    }
    response.json({ received: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.json({ limit: "64kb" }));

const publicBookingLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many booking attempts. Please try again later." }
});
const loginLimit = createDatabaseRateLimiter(prisma, {
  scope: "login",
  limit: 10,
  message: "Too many sign-in attempts. Please try again later."
});
const registrationLimit = createDatabaseRateLimiter(prisma, {
  scope: "registration",
  limit: 6,
  message: "Too many registration attempts. Please try again later."
});
const emailVerificationLimit = createDatabaseRateLimiter(prisma, {
  scope: "email-verification",
  limit: 6,
  message: "Too many verification attempts. Please try again later."
});
const passwordResetRequestLimit = createDatabaseRateLimiter(prisma, {
  scope: "password-reset-request",
  limit: 6,
  message: "Too many password-reset requests. Please try again later."
});
const passwordResetLimit = createDatabaseRateLimiter(prisma, {
  scope: "password-reset",
  limit: 6,
  message: "Too many password-reset attempts. Please try again later."
});
const publicOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use((request, response, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return next();
  const origin = request.get("origin");
  if (!origin) return next();
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!allowedOrigins.includes(origin)) return response.status(403).json({ error: "Request origin is not allowed." });
  next();
});
app.use("/api/auth", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api/admin", createAdminRouter(prisma, requireAdministrator));

function hashAccessToken(token) {
  return hashToken(token);
}

async function loadAuthenticatedUser(request) {
  const token = readSessionCookie(request.get("cookie"));
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.userSession.delete({ where: { id: session.id } });
    return null;
  }
  request.auth = { sessionId: session.id, user: session.user };
  return session.user;
}

async function optionalAuthentication(request, _response, next) {
  try {
    await loadAuthenticatedUser(request);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuthentication(request, response, next) {
  try {
    const user = await loadAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: "Please sign in to continue." });
    if (!user.emailVerifiedAt) return response.status(403).json({ error: "Verify your email address to continue." });
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAdministrator(request, response, next) {
  try {
    const user = await loadAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: "Please sign in to continue." });
    if (user.role !== "ADMIN" || !user.emailVerifiedAt) return response.status(403).json({ error: "Administrator access is required." });
    next();
  } catch (error) {
    next(error);
  }
}

async function createEmailToken(userId, purpose, expiresInMs) {
  const token = createOpaqueToken();
  await prisma.$transaction(async (transaction) => {
    await transaction.emailToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    await transaction.emailToken.create({
      data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + expiresInMs) }
    });
  });
  return token;
}

async function sendAccountEmail(user, token, purpose) {
  const origin = (process.env.FRONTEND_ORIGIN || "http://localhost:5173").split(",")[0].trim();
  const reset = purpose === "PASSWORD_RESET";
  const url = new URL("/", origin);
  url.searchParams.set(reset ? "reset_token" : "verify_token", token);
  const action = reset ? "reset your password" : "verify your email address";
  await sendTransactionalEmail({
    to: user.email,
    subject: reset ? "Reset your KrunchyKremmy password" : "Verify your KrunchyKremmy email",
    html: `<p>Hello ${escapeHtml(user.name)},</p><p>Use this link to ${action}:</p><p><a href="${escapeHtml(url.toString())}">${escapeHtml(action)}</a></p><p>This link expires in ${reset ? "one hour" : "24 hours"}.</p>`
  });
}

app.post("/api/auth/register", registrationLimit, async (request, response, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(254),
      password: z.string().min(12).max(128)
    }).strict().parse(request.body);
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    let user = existing;
    if (!user) {
      user = await prisma.user.create({
        data: { name: input.name, email, passwordHash: await hashPassword(input.password) }
      });
    }
    if (!user.emailVerifiedAt) {
      const token = await createEmailToken(user.id, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000);
      try {
        await sendAccountEmail(user, token, "EMAIL_VERIFICATION");
        return response.status(202).json({ message: "If this account can be registered, a verification link has been sent." });
      } catch (error) {
        console.error("Verification email delivery failed.");
        if (process.env.NODE_ENV === "development") {
          return response.status(202).json({ message: "Email delivery is not configured.", developmentToken: token });
        }
        return next(error);
      }
    }
    response.status(202).json({ message: "If this account can be registered, a verification link has been sent." });
  } catch (error) {
    if (error.code === "P2002") return response.status(202).json({ message: "If this account can be registered, a verification link has been sent." });
    next(error);
  }
});

app.post("/api/auth/verify-email", emailVerificationLimit, async (request, response, next) => {
  try {
    const { token } = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/) }).strict().parse(request.body);
    const record = await prisma.emailToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true }
    });
    if (!record || record.purpose !== "EMAIL_VERIFICATION" || record.consumedAt || record.expiresAt <= new Date()) {
      return response.status(400).json({ error: "This verification link is invalid or expired." });
    }
    const sessionToken = createOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.emailToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now }
      });
      if (consumed.count !== 1) {
        const error = new Error("This verification link is invalid or expired.");
        error.status = 400;
        throw error;
      }
      await transaction.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
      await transaction.userSession.create({
        data: { userId: record.userId, tokenHash: hashToken(sessionToken), expiresAt }
      });
    });
    response.setHeader("Set-Cookie", sessionCookie(sessionToken));
    response.json({ user: publicUser({ ...record.user, emailVerifiedAt: now }) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", loginLimit, async (request, response, next) => {
  try {
    const input = z.object({
      email: z.string().trim().email().max(254),
      password: z.string().min(1).max(128)
    }).strict().parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const valid = await verifyPassword(input.password, user?.passwordHash ||
      "scrypt$16384$8$1$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
    const now = new Date();
    const ipHash = hashSecurityIdentifier(request.ip || request.socket?.remoteAddress || "unknown");
    if (!user || !valid || !user.emailVerifiedAt || (user.loginLockedUntil && user.loginLockedUntil > now)) {
      if (user && !user.emailVerifiedAt && valid) {
        return response.status(401).json({ error: "Email or password is incorrect." });
      }
      if (user && user.loginLockedUntil && user.loginLockedUntil > now) {
        await prisma.securityEvent.create({ data: { type: "ACCOUNT_LOGIN_BLOCKED", userId: user.id, ipHash } });
      } else if (user && !valid) {
        await prisma.$transaction(async (transaction) => {
          const [current] = await transaction.$queryRaw`
            SELECT "failedLoginAttempts", "loginFailureWindowStartedAt", "loginLockedUntil"
            FROM "User" WHERE "id" = ${user.id} FOR UPDATE
          `;
          if (!current) return;
          const failure = nextLoginFailureState(current, now);
          if (failure.locked) {
            await transaction.securityEvent.create({
              data: { type: "ACCOUNT_LOGIN_BLOCKED", userId: user.id, ipHash }
            });
            return;
          }
          await transaction.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: failure.failedLoginAttempts,
              loginFailureWindowStartedAt: failure.loginFailureWindowStartedAt,
              loginLockedUntil: failure.loginLockedUntil
            }
          });
          await transaction.securityEvent.create({ data: { type: "LOGIN_FAILED", userId: user.id, ipHash } });
          if (failure.loginLockedUntil) {
            await transaction.securityEvent.create({ data: { type: "ACCOUNT_LOCKED", userId: user.id, ipHash } });
          }
        });
      } else if (!user) {
        await prisma.securityEvent.create({ data: { type: "LOGIN_FAILED", ipHash } });
      }
      return response.status(401).json({ error: "Email or password is incorrect." });
    }
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const authenticated = await prisma.$transaction(async (transaction) => {
      const [current] = await transaction.$queryRaw`
        SELECT "loginLockedUntil", "emailVerifiedAt", "passwordHash"
        FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      if (!current || current.passwordHash !== user.passwordHash || !current.emailVerifiedAt ||
          (current.loginLockedUntil && current.loginLockedUntil > now)) return false;
      await transaction.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, loginFailureWindowStartedAt: null, loginLockedUntil: null }
      });
      await transaction.userSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
      await transaction.securityEvent.create({ data: { type: "LOGIN_SUCCEEDED", userId: user.id, ipHash } });
      return true;
    });
    if (!authenticated) return response.status(401).json({ error: "Email or password is incorrect." });
    response.setHeader("Set-Cookie", sessionCookie(token));
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", optionalAuthentication, async (request, response, next) => {
  try {
    if (request.auth?.sessionId) await prisma.userSession.delete({ where: { id: request.auth.sessionId } });
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuthentication, (request, response) => {
  response.json({ user: publicUser(request.auth.user) });
});

app.get("/api/account/orders", requireAuthentication, async (request, response, next) => {
  try {
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    }).parse(request.query);
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { userId: request.auth.user.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          fulfillmentMethod: true,
          fulfillmentTimeZone: true,
          deliveryZoneName: true,
          deliveryNeighborhood: true,
          recipientName: true,
          recipientPhone: true,
          deliveryAddress: true,
          pickupLocationName: true,
          pickupLocationAddress: true,
          pickupLocationPhone: true,
          deliveryFeeCents: true,
          totalCents: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          createdAt: true,
          items: { select: { id: true, productName: true, quantity: true, customization: true } },
          statusHistory: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.order.count({ where: { userId: request.auth.user.id } })
    ]);
    response.json({ orders, page, limit, total });
  } catch (error) {
    next(error);
  }
});

app.post("/api/account/orders/:orderNumber/retry-payment", publicOperationLimit, requireAuthentication, async (request, response, next) => {
  try {
    const reservationMinutes = assertCheckoutConfiguration();
    await expireFulfillmentReservations();
    const orderNumber = z.string().trim().min(1).max(64).parse(request.params.orderNumber);
    let current = await prisma.order.findFirst({
      where: { orderNumber, userId: request.auth.user.id },
      include: { items: true }
    });
    if (!current) return response.status(404).json({ error: "Order not found." });

    const unresolvedAttempts = await prisma.paymentAttempt.findMany({
      where: { orderId: current.id, reconciliationRequired: true },
      select: { reference: true }
    });
    for (const attempt of unresolvedAttempts) {
      const verified = await verifyPaystackTransaction(attempt.reference);
      if (verified.status === "success") {
        await settleOrderByReference(attempt.reference, verified);
        const settled = await prisma.order.findUnique({
          where: { id: current.id },
          select: { orderNumber: true, paymentStatus: true, status: true }
        });
        return response.json(settled);
      }
      if (verified.status !== "failed") {
        return response.status(409).json({
          error: "A previous payment is still unresolved. Do not retry until Paystack confirms its final status."
        });
      }
      await releaseOrderByReference(attempt.reference, verified);
    }
    if (unresolvedAttempts.length) {
      current = await prisma.order.findFirst({
        where: { orderNumber, userId: request.auth.user.id },
        include: { items: true }
      });
      if (!current) return response.status(404).json({ error: "Order not found." });
    }

    if (current.paymentStatus === "PENDING" && current.status === "PENDING" && current.reservationActive) {
      if (current.paymentAuthorizationUrl) {
        return response.json({ orderNumber: current.orderNumber, checkoutUrl: current.paymentAuthorizationUrl });
      }
      return response.status(409).json({
        error: "Payment setup is still being verified. Do not retry this payment yet; contact the shop if it remains unresolved."
      });
    }

    if (
      current.paymentStatus !== "FAILED" ||
      current.status !== "CANCELLED" ||
      !current.fulfillmentMethod ||
      !current.scheduledStartAt ||
      !current.scheduledEndAt
    ) {
      return response.status(409).json({ error: "This order is not eligible for payment retry." });
    }
    const fulfillment = await resolveFulfillment({
      fulfillment: {
        method: current.fulfillmentMethod,
        zoneId: current.deliveryZoneId || undefined,
        neighborhood: current.deliveryNeighborhood || undefined,
        recipientName: current.recipientName || undefined,
        phone: current.recipientPhone || undefined,
        address: current.deliveryAddress || undefined,
        building: current.deliveryBuilding || undefined,
        landmark: current.deliveryLandmark || undefined,
        instructions: current.deliveryInstructions || undefined,
        customerNotes: current.customerNotes || undefined,
        slotStartsAt: current.scheduledStartAt.toISOString(),
        slotEndsAt: current.scheduledEndAt.toISOString()
      }
    });
    const reopened = await prisma.$transaction(async (transaction) => {
      await assertFulfillmentConfiguration(transaction, fulfillment);
      for (const item of current.items) {
        if (item.productId) {
          const reserved = await transaction.product.updateMany({
            where: { id: item.productId, available: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } }
          });
          if (reserved.count !== 1) {
            const error = new Error("A product is no longer available in the required quantity.");
            error.status = 409;
            throw error;
          }
        }
        const customization = item.customization;
        if (customization && typeof customization === "object" && Array.isArray(customization.optionIds)) {
          for (const optionId of customization.optionIds) {
            const reserved = await transaction.builderOption.updateMany({
              where: { id: optionId, active: true, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } }
            });
            if (reserved.count !== 1) {
              const error = new Error("A selected option is no longer available.");
              error.status = 409;
              throw error;
            }
          }
        }
      }
      const slot = await transaction.fulfillmentSlot.findUnique({
        where: { id: fulfillment.slotId },
        select: { capacity: true }
      });
      const reservedSlot = slot ? await transaction.fulfillmentSlot.updateMany({
        where: {
          id: fulfillment.slotId,
          method: fulfillment.method,
          startsAt: fulfillment.startsAt,
          capacity: slot.capacity,
          reservedCount: { lt: slot.capacity }
        },
        data: { reservedCount: { increment: 1 } }
      }) : { count: 0 };
      if (!reservedSlot.count) {
        const error = new Error("That fulfilment time is no longer available. Choose a new time by starting checkout again.");
        error.status = 409;
        throw error;
      }
      const claimed = await transaction.order.updateMany({
        where: {
          id: current.id,
          userId: request.auth.user.id,
          paymentStatus: "FAILED",
          status: "CANCELLED",
          reservationActive: false
        },
        data: {
          paymentStatus: "PENDING",
          status: "PENDING",
          reservationExpiresAt: new Date(Date.now() + reservationMinutes * 60000),
          reservationActive: true,
          scheduleSlotId: fulfillment.slotId,
          paymentReference: null,
          paymentAuthorizationUrl: null,
          providerTransactionId: null
        }
      });
      if (!claimed.count) {
        const error = new Error("This order was updated before its payment retry could start.");
        error.status = 409;
        throw error;
      }
      await transaction.orderStatusHistory.create({
        data: {
          orderId: current.id,
          fromStatus: current.status,
          toStatus: "PENDING",
          actorId: request.auth.user.id,
          reason: "Customer safely re-reserved inventory and fulfilment capacity for payment retry."
        }
      });
      return transaction.order.findUnique({ where: { id: current.id } });
    }, { isolationLevel: "Serializable" });
    try {
      const payment = await initializeOrderPayment(reopened, process.env.FRONTEND_ORIGIN || "http://localhost:5173");
      response.json({ orderNumber: reopened.orderNumber, checkoutUrl: payment.authorizationUrl });
    } catch (error) {
      if (!error.outcomeUnknown) {
        await prisma.$transaction(async (transaction) => {
          const reservedOrder = await transaction.order.findUnique({
            where: { id: reopened.id },
            include: { items: true }
          });
          const cancelled = await transaction.order.updateMany({
            where: { id: reopened.id, paymentStatus: "PENDING" },
            data: { paymentStatus: "FAILED", status: "CANCELLED", reservationActive: false }
          });
          if (cancelled.count !== 1) return;
          if (reservedOrder) await releaseOrderResources(transaction, reservedOrder);
          await transaction.orderStatusHistory.create({
            data: {
              orderId: reopened.id,
              fromStatus: "PENDING",
              toStatus: "CANCELLED",
              actorId: "checkout",
              reason: "Paystack payment retry initialization failed."
            }
          });
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/account/bookings", requireAuthentication, async (request, response, next) => {
  try {
    const { page, limit } = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    }).parse(request.query);
    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where: { userId: request.auth.user.id },
        include: {
          eventType: { select: { name: true } },
          services: { select: { serviceName: true, servings: true, customization: true } },
          quotations: { orderBy: { version: "desc" }, take: 1 },
          history: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.booking.count({ where: { userId: request.auth.user.id } })
    ]);
    response.json({ bookings, page, limit, total });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password", passwordResetRequestLimit, async (request, response, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email().max(254) }).strict().parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user?.emailVerifiedAt) {
      const token = await createEmailToken(user.id, "PASSWORD_RESET", 60 * 60 * 1000);
      try {
        await sendAccountEmail(user, token, "PASSWORD_RESET");
      } catch {
        console.error("Password-reset email delivery failed.");
        if (process.env.NODE_ENV === "development") {
          return response.json({ message: "If an account exists, password reset instructions have been sent.", developmentToken: token });
        }
      }
    }
    response.json({ message: "If an account exists, password reset instructions have been sent." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", passwordResetLimit, async (request, response, next) => {
  try {
    const { token, password } = z.object({
      token: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/),
      password: z.string().min(12).max(128)
    }).strict().parse(request.body);
    const record = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = new Date();
    if (!record || record.purpose !== "PASSWORD_RESET" || record.consumedAt || record.expiresAt <= now) {
      return response.status(400).json({ error: "This password-reset link is invalid or expired." });
    }
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.emailToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now }
      });
      if (consumed.count !== 1) {
        const error = new Error("This password-reset link is invalid or expired.");
        error.status = 400;
        throw error;
      }
      await transaction.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await hashPassword(password),
          failedLoginAttempts: 0,
          loginFailureWindowStartedAt: null,
          loginLockedUntil: null
        }
      });
      await transaction.userSession.deleteMany({ where: { userId: record.userId } });
      await transaction.securityEvent.create({ data: { type: "PASSWORD_RECOVERED", userId: record.userId } });
    });
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.json({ message: "Password updated. Please sign in again." });
  } catch (error) {
    next(error);
  }
});

function constantTimeHexMatch(actual, expected) {
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function localEventTime(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdays[values.weekday],
    minutes: Number(values.hour) * 60 + Number(values.minute)
  };
}

async function reviewEventAvailability(startsAt, endsAt, customerTimeZone) {
  const [availability, blackout, overlappingEvents] = await Promise.all([
    prisma.bookingAvailability.findFirst({ where: { active: true } }),
    prisma.eventBlackoutDate.findFirst({
      where: { active: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      select: { id: true }
    }),
    prisma.booking.count({
      where: {
        status: { in: ["CONFIRMED", "IN_PREPARATION"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt }
      }
    })
  ]);
  const reasons = [];
  if (!availability) {
    reasons.push("Business hours and service capacity have not been configured");
  } else {
    const timeZone = availability.timeZone || customerTimeZone;
    const startLocal = localEventTime(startsAt, timeZone);
    const endLocal = localEventTime(endsAt, timeZone);
    const operatingDays = Array.isArray(availability.operatingDays) ? availability.operatingDays : [];
    const [openHour, openMinute] = availability.availableStartTime.split(":").map(Number);
    const [closeHour, closeMinute] = availability.availableEndTime.split(":").map(Number);
    if (!operatingDays.includes(startLocal.weekday) || startLocal.weekday !== endLocal.weekday ||
        startLocal.minutes < openHour * 60 + openMinute || endLocal.minutes > closeHour * 60 + closeMinute) {
      reasons.push("Requested time is outside configured event hours");
    }
    if (startsAt.getTime() < Date.now() + availability.minimumLeadHours * 60 * 60 * 1000) {
      reasons.push("Request is inside the minimum advance-booking window");
    }
    if (startsAt.getTime() > Date.now() + availability.maximumHorizonDays * 86400000) {
      reasons.push("Request is beyond the current booking calendar");
    }
    if (overlappingEvents.length >= availability.maximumConcurrent) {
      reasons.push("Existing events may use available capacity");
    }
  }
  if (blackout) reasons.push("Requested time overlaps a blackout date");
  reasons.push("Staff must confirm date, location, and capacity; this request does not reserve a slot");
  return reasons.join(". ");
}

app.get("/api/health", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories", async (_request, response, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, description: true, imageUrl: true }
    });
    response.json({ categories });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", async (_request, response, next) => {
  try {
    const [eventTypes, services, packages] = await prisma.$transaction([
      prisma.eventType.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, description: true }
      }),
      prisma.eventService.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, description: true, imageUrl: true, includes: true, customizationOptions: true, startingPriceCents: true }
      }),
      prisma.eventPackage.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, slug: true, description: true, priceMode: true,
          priceCents: true, minimumGuests: true,
          items: { select: { service: { select: { id: true, name: true, slug: true } } } }
        }
      })
    ]);
    response.json({ eventTypes, services, packages });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events/availability", async (request, response, next) => {
  try {
    const { startsAt, endsAt, timeZone } = z.object({
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      timeZone: z.string().min(1).max(64)
    }).parse(request.query);
    const { startsAt: start, endsAt: end } = validateBookingTime({ startsAt, endsAt, timeZone });
    const reason = await reviewEventAvailability(start, end, timeZone);
    response.json({
      requestable: true,
      firmAvailability: false,
      manualReviewRequired: true,
      reason,
      timeZone
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", publicBookingLimit, optionalAuthentication, async (request, response, next) => {
  let requestHash;
  try {
    const input = bookingSchema.parse(request.body);
    if (input.honeypot) return response.status(400).json({ error: "Booking request could not be accepted." });
    requestHash = bookingRequestHash(input);
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { reference: true, accessTokenHash: true, idempotencyRequestHash: true }
    });
    if (existing) {
      if (existing.idempotencyRequestHash && existing.idempotencyRequestHash !== requestHash) {
        return response.status(409).json({ error: "This booking request key is already in use." });
      }
      const accessTokenMatches = constantTimeHexMatch(hashAccessToken(input.idempotencyKey), existing.accessTokenHash);
      return response.status(200).json({
        reference: existing.reference,
        duplicate: true,
        ...(accessTokenMatches ? { accessToken: input.idempotencyKey } : {})
      });
    }

    const now = new Date();
    const { startsAt, endsAt } = validateBookingTime(input, now);
    const availabilityNote = await reviewEventAvailability(startsAt, endsAt, input.timeZone);

    const [eventType, serviceRecords, selectedPackage] = await Promise.all([
      prisma.eventType.findFirst({ where: { slug: input.eventTypeSlug, active: true }, select: { id: true } }),
      prisma.eventService.findMany({
        where: { id: { in: input.services.map((service) => service.serviceId) }, active: true },
        select: { id: true, name: true, customizationOptions: true }
      }),
      input.packageId
        ? prisma.eventPackage.findFirst({
          where: { id: input.packageId, active: true },
          select: { id: true, minimumGuests: true, items: { select: { serviceId: true } } }
        })
        : Promise.resolve(null)
    ]);
    if (!eventType) return response.status(400).json({ error: "Choose an available event type." });
    if (input.eventTypeSlug === "other" && !input.otherEventType?.trim()) {
      return response.status(400).json({ error: "Please describe your event." });
    }
    if (serviceRecords.length !== input.services.length || new Set(input.services.map((service) => service.serviceId)).size !== input.services.length) {
      return response.status(409).json({ error: "One or more selected services are unavailable." });
    }
    if (input.packageId && !selectedPackage) return response.status(409).json({ error: "The selected package is unavailable." });
    if (selectedPackage && input.guestCount < selectedPackage.minimumGuests) {
      return response.status(400).json({ error: `This package needs at least ${selectedPackage.minimumGuests} guests.` });
    }
    if (selectedPackage && selectedPackage.items.some((item) => !input.services.some((service) => service.serviceId === item.serviceId))) {
      return response.status(400).json({ error: "Include all services from the selected package." });
    }

    const customizationById = new Map(serviceRecords.map((service) => [service.id, service.customizationOptions]));
    for (const service of input.services) {
      validateServiceCustomization(service.customization, customizationById.get(service.serviceId));
    }

    const namesById = new Map(serviceRecords.map((service) => [service.id, service.name]));
    const reference = `EVT-${randomBytes(5).toString("hex").toUpperCase()}`;
    const accessToken = input.idempotencyKey;
    const booking = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.booking.create({
        data: {
          reference,
          idempotencyKey: input.idempotencyKey,
          idempotencyRequestHash: requestHash,
          accessTokenHash: hashAccessToken(accessToken),
          userId: request.auth?.user.id,
          eventTypeId: eventType.id,
          packageId: selectedPackage?.id,
          eventName: input.eventName,
          otherEventType: input.eventTypeSlug === "other" ? input.otherEventType : null,
          startsAt,
          endsAt,
          timeZone: input.timeZone,
          guestCount: input.guestCount,
          ageGroup: input.ageGroup,
          venueName: input.venueName,
          venueType: input.venueType,
          address: input.address,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          setupType: input.setupType,
          accessInstructions: input.accessInstructions,
          customerName: input.customerName,
          customerEmail: (request.auth?.user.email || input.customerEmail).toLowerCase(),
          customerPhone: input.customerPhone,
          contactMethod: input.contactMethod,
          companyName: input.companyName,
          specialRequests: input.specialRequests,
          budgetRange: input.budgetRange,
          consentAcceptedAt: now,
          consentVersion: "event-request-consent-v1",
          availabilityNote,
          services: {
            create: input.services.map((service) => ({
              serviceId: service.serviceId,
              serviceName: namesById.get(service.serviceId),
              servings: service.servings,
              customization: service.customization
            }))
          },
          history: { create: { toStatus: "REQUESTED", reason: "Customer submitted an event request." } }
        },
        select: { reference: true, status: true, paymentStatus: true, createdAt: true }
      });
      return saved;
    }, { isolationLevel: "Serializable" });
    response.status(201).json({
      ...booking,
      accessToken,
      quoteStatus: "REQUEST_A_QUOTE",
      message: "Your request is received, not confirmed. Our team will review availability and follow up."
    });
  } catch (error) {
    if (error.code === "P2002" && String(error.meta?.target || "").includes("idempotencyKey")) {
      try {
        const key = request.body?.idempotencyKey;
        const existing = typeof key === "string"
          ? await prisma.booking.findUnique({
            where: { idempotencyKey: key },
            select: { reference: true, accessTokenHash: true, idempotencyRequestHash: true }
          })
          : null;
        if (existing) {
          if (existing.idempotencyRequestHash && existing.idempotencyRequestHash !== requestHash) {
            return response.status(409).json({ error: "This booking request key is already in use." });
          }
          const accessTokenMatches = constantTimeHexMatch(hashAccessToken(key), existing.accessTokenHash);
          return response.status(200).json({
            reference: existing.reference,
            duplicate: true,
            ...(accessTokenMatches ? { accessToken: key } : {})
          });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    next(error);
  }
});

app.get("/api/bookings/:reference", publicBookingLimit, async (request, response, next) => {
  try {
    const reference = z.string().regex(/^EVT-[A-F0-9]{10}$/).parse(request.params.reference);
    const accessToken = z.string().min(32).max(64).parse(request.get("x-booking-access-token"));
    const booking = await prisma.booking.findUnique({
      where: { reference },
      include: {
        eventType: { select: { name: true } },
        services: { select: { serviceName: true, servings: true, customization: true } },
        quotations: { orderBy: { version: "desc" }, take: 1 }
      }
    });
    if (!booking || !constantTimeHexMatch(hashAccessToken(accessToken), booking.accessTokenHash)) {
      return response.status(404).json({ error: "Booking request not found." });
    }
    const {
      accessTokenHash: _accessTokenHash,
      idempotencyKey: _idempotencyKey,
      userId: _userId,
      ...privateBooking
    } = booking;
    response.json(privateBooking);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (request, response, next) => {
  try {
    const querySchema = z.object({
      category: z.string().optional(),
      search: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(12),
      sort: z.enum(["featured", "newest", "price-low", "price-high"]).default("featured")
    });
    const query = querySchema.parse(request.query);
    const where = {
      available: true,
      stock: { gt: 0 },
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } }
      ] } : {})
    };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: { select: { name: true, slug: true } } },
        orderBy: query.sort === "newest" ? [{ createdAt: "desc" }, { name: "asc" }]
          : query.sort === "price-low" ? [{ priceCents: "asc" }, { name: "asc" }]
            : query.sort === "price-high" ? [{ priceCents: "desc" }, { name: "asc" }]
              : [{ featured: "desc" }, { name: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      prisma.product.count({ where })
    ]);
    response.json({ products, page: query.page, limit: query.limit, total });
  } catch (error) {
    next(error);
  }
});

app.get("/api/builders/:kind", async (request, response, next) => {
  try {
    const kind = z.enum(["waffle", "sundae", "candy", "popcorn", "cotton-candy", "ice-cream-cone"]).parse(request.params.kind);
    const options = await prisma.builderOption.findMany({
      where: { kind, active: true, stock: { gt: 0 } },
      orderBy: [{ groupKey: "asc" }, { name: "asc" }],
      select: { id: true, groupKey: true, name: true, priceCents: true, maxSelections: true }
    });
    const groups = Object.groupBy
      ? Object.groupBy(options, (option) => option.groupKey)
      : options.reduce((grouped, option) => {
        (grouped[option.groupKey] ||= []).push(option);
        return grouped;
      }, {});
    response.json({ kind, groups });
  } catch (error) {
    next(error);
  }
});

app.post("/api/pricing/quote", publicOperationLimit, async (request, response, next) => {
  try {
    const selection = builderSelectionSchema.parse(request.body);
    const quote = await quoteBuilder(prisma, selection);
    response.json(quote);
  } catch (error) {
    next(error);
  }
});

function dateKeyInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function assertCheckoutConfiguration() {
  const reservationMinutes = Number(process.env.PAYMENT_RESERVATION_MINUTES);
  if (
    process.env.CHECKOUT_ENABLED !== "true" ||
    !process.env.PAYSTACK_SECRET_KEY ||
    (process.env.PAYSTACK_CURRENCY || "ngn").toLowerCase() !== "ngn" ||
    !Number.isInteger(reservationMinutes) ||
    reservationMinutes < 1 ||
    reservationMinutes > 1440
  ) {
    const error = new Error("Online checkout is not enabled. Please contact the shop.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return reservationMinutes;
}

export async function expireFulfillmentReservations(now = new Date()) {
  const expired = await prisma.order.findMany({
    where: { reservationActive: true, reservationExpiresAt: { lte: now }, paymentStatus: "PENDING" },
    include: { items: true }
  });
  for (const order of expired) {
    await prisma.$transaction(async (transaction) => {
      const released = await transaction.order.updateMany({
        where: {
          id: order.id,
          reservationActive: true,
          reservationExpiresAt: { lte: now },
          paymentStatus: "PENDING"
        },
        data: { reservationActive: false, paymentStatus: "FAILED", status: "CANCELLED" }
      });
      if (!released.count) return;
      await releaseOrderResources(transaction, order);
      await transaction.paymentAttempt.updateMany({
        where: { orderId: order.id, status: "PENDING" },
        data: { status: "FAILED" }
      });
      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "CANCELLED",
          actorId: "reservation-expiry",
          reason: "Payment reservation expired before verified payment."
        }
      });
    });
  }
}

async function getPublicFulfillmentConfiguration() {
  const [zones, pickupLocation, schedules] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.pickupLocation.findFirst({ where: { id: "primary", active: true } }),
    prisma.fulfillmentSchedule.findMany({ where: { active: true } })
  ]);
  const scheduleMethods = new Set(schedules.map((schedule) => schedule.method));
  const reservationMinutes = Number(process.env.PAYMENT_RESERVATION_MINUTES);
  return {
    currency: "ngn",
    deliveryZones: zones,
    pickupLocation,
    timeZones: Object.fromEntries(schedules.map((schedule) => [schedule.method, schedule.timeZone])),
    deliveryEnabled: zones.length > 0 && scheduleMethods.has("DELIVERY"),
    pickupEnabled: Boolean(pickupLocation) && scheduleMethods.has("PICKUP"),
    onlinePaymentEnabled: process.env.CHECKOUT_ENABLED === "true" &&
      Boolean(process.env.PAYSTACK_SECRET_KEY) &&
      (process.env.PAYSTACK_CURRENCY || "ngn").toLowerCase() === "ngn" &&
      Number.isInteger(reservationMinutes) &&
      reservationMinutes >= 1 &&
      reservationMinutes <= 1440
  };
}

async function loadAvailableSlots(method, date, zoneId, now = new Date()) {
  const schedule = await prisma.fulfillmentSchedule.findUnique({ where: { method } });
  if (!schedule?.active) return [];
  let minimumLeadMinutes = schedule.minimumLeadMinutes;
  if (method === "DELIVERY") {
    const zone = await prisma.deliveryZone.findFirst({ where: { id: zoneId, active: true } });
    if (!zone) {
      const error = new Error("Choose an active delivery zone.");
      error.status = 400;
      throw error;
    }
    minimumLeadMinutes = Math.max(minimumLeadMinutes, zone.minimumLeadMinutes);
  } else {
    const pickupLocation = await prisma.pickupLocation.findFirst({ where: { id: "primary", active: true } });
    if (!pickupLocation) {
      const error = new Error("Customer pickup is not configured yet.");
      error.status = 503;
      throw error;
    }
  }
  const today = dateKeyInTimeZone(now, schedule.timeZone);
  const targetDay = Date.parse(`${date}T00:00:00Z`);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  const horizonEnd = todayDay + schedule.maximumHorizonDays * 86400000;
  if (!Number.isFinite(targetDay) || targetDay < todayDay || targetDay > horizonEnd) return [];
  const dayStart = localDateTimeToUtc(date, "00:00", schedule.timeZone);
  const nextDate = new Date(targetDay + 86400000).toISOString().slice(0, 10);
  const dayEnd = localDateTimeToUtc(nextDate, "00:00", schedule.timeZone);
  const blackouts = await prisma.fulfillmentBlackoutDate.findMany({
    where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }
  });
  const possibleSlots = generateScheduleSlots(schedule, date, now, minimumLeadMinutes, blackouts);
  const available = [];
  for (const item of possibleSlots) {
    const slot = await prisma.fulfillmentSlot.upsert({
      where: { method_startsAt: { method, startsAt: item.startsAt } },
      create: {
        method,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        capacity: schedule.maximumOrdersPerSlot
      },
      update: {
        endsAt: item.endsAt,
        capacity: schedule.maximumOrdersPerSlot
      }
    });
    if (slot.reservedCount < slot.capacity) {
      available.push({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        remainingCapacity: slot.capacity - slot.reservedCount,
        method,
        timeZone: schedule.timeZone
      });
    }
  }
  return available;
}

async function resolveFulfillment(input, now = new Date()) {
  const method = input.fulfillment.method;
  const requestedStart = new Date(input.fulfillment.slotStartsAt);
  const requestedEnd = new Date(input.fulfillment.slotEndsAt);
  if (!Number.isFinite(requestedStart.getTime()) || !Number.isFinite(requestedEnd.getTime()) || requestedEnd <= requestedStart) {
    const error = new Error("Choose a valid available fulfilment time.");
    error.status = 400;
    throw error;
  }
  let feeCents = 0;
  let fulfillmentSnapshot;
  let minimumLeadMinutes = 0;
  let serviceUpdatedAt;
  if (method === "DELIVERY") {
    const zone = await prisma.deliveryZone.findFirst({ where: { id: input.fulfillment.zoneId, active: true } });
    if (!zone) {
      const error = new Error("The selected delivery zone is unavailable.");
      error.status = 409;
      throw error;
    }
    if (!zone.neighborhoods.some((item) => item.toLowerCase() === input.fulfillment.neighborhood.toLowerCase())) {
      const error = new Error("That neighbourhood is not serviceable in the selected zone.");
      error.status = 400;
      throw error;
    }
    feeCents = zone.feeCents;
    minimumLeadMinutes = zone.minimumLeadMinutes;
    serviceUpdatedAt = zone.updatedAt;
    fulfillmentSnapshot = {
      fulfillmentMethod: method,
      deliveryZoneId: zone.id,
      deliveryZoneName: zone.name,
      deliveryNeighborhood: input.fulfillment.neighborhood,
      recipientName: input.fulfillment.recipientName,
      recipientPhone: input.fulfillment.phone,
      deliveryAddress: input.fulfillment.address,
      deliveryBuilding: input.fulfillment.building || null,
      deliveryLandmark: input.fulfillment.landmark || null,
      deliveryInstructions: input.fulfillment.instructions || null,
      customerNotes: input.fulfillment.customerNotes || null
    };
  } else {
    const location = await prisma.pickupLocation.findFirst({ where: { id: "primary", active: true } });
    if (!location) {
      const error = new Error("Customer pickup is not configured yet.");
      error.status = 503;
      throw error;
    }
    serviceUpdatedAt = location.updatedAt;
    fulfillmentSnapshot = {
      fulfillmentMethod: method,
      recipientName: input.fulfillment.recipientName,
      recipientPhone: input.fulfillment.phone,
      pickupLocationName: location.name,
      pickupLocationAddress: `${location.address}, ${location.neighborhood}, ${location.city}, ${location.state}`,
      pickupLocationPhone: location.phone || null,
      pickupInstructions: location.instructions || null,
      customerNotes: input.fulfillment.customerNotes || null
    };
  }
  const schedule = await prisma.fulfillmentSchedule.findUnique({ where: { method } });
  if (!schedule?.active) {
    const error = new Error("Scheduling for this fulfilment method is not configured.");
    error.status = 503;
    throw error;
  }
  fulfillmentSnapshot.fulfillmentTimeZone = schedule.timeZone;
  const localDate = dateKeyInTimeZone(requestedStart, schedule.timeZone);
  const slots = await loadAvailableSlots(method, localDate, input.fulfillment.zoneId, now);
  const validSlot = slots.find((slot) =>
    slot.startsAt.getTime() === requestedStart.getTime() &&
    slot.endsAt.getTime() === requestedEnd.getTime()
  );
  if (!validSlot) {
    const error = new Error("That fulfilment time is no longer available. Choose another slot.");
    error.status = 409;
    throw error;
  }
  return {
    method,
    feeCents,
    slotId: validSlot.id,
    startsAt: validSlot.startsAt,
    endsAt: validSlot.endsAt,
    minimumLeadMinutes,
    scheduleUpdatedAt: schedule.updatedAt,
    serviceUpdatedAt,
    snapshot: fulfillmentSnapshot
  };
}

app.get("/api/fulfillment/config", publicOperationLimit, async (_request, response, next) => {
  try {
    response.json(await getPublicFulfillmentConfiguration());
  } catch (error) {
    next(error);
  }
});

app.get("/api/fulfillment/slots", publicOperationLimit, async (request, response, next) => {
  try {
    const query = z.object({
      method: z.enum(["DELIVERY", "PICKUP"]),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      zoneId: z.string().optional()
      }).superRefine((value, context) => {
        if (value.method === "DELIVERY" && !value.zoneId) {
          context.addIssue({ code: "custom", path: ["zoneId"], message: "Choose a delivery zone." });
        }
      }).parse(request.query);
    await expireFulfillmentReservations();
    response.json({ slots: await loadAvailableSlots(query.method, query.date, query.zoneId) });
  } catch (error) {
    next(error);
  }
});

const orderSchema = z.object({
  email: z.string().trim().email().max(254),
  fulfillment: z.object({
    method: z.enum(["DELIVERY", "PICKUP"]),
    zoneId: z.string().optional(),
    neighborhood: z.string().trim().min(1).max(120).optional(),
    recipientName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(7).max(40).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    building: z.string().trim().max(200).optional(),
    landmark: z.string().trim().max(300).optional(),
    instructions: z.string().trim().max(1000).optional(),
    customerNotes: z.string().trim().max(1000).optional(),
    slotStartsAt: z.string().datetime({ offset: true }),
    slotEndsAt: z.string().datetime({ offset: true })
  }).strict().superRefine((value, context) => {
    for (const field of ["recipientName", "phone"]) {
      if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "This field is required." });
    }
    if (value.method === "DELIVERY") {
      for (const field of ["zoneId", "neighborhood", "address"]) {
        if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "This field is required for delivery." });
      }
    }
  }),
  items: z.array(z.object({
    productId: z.string().optional(),
    quantity: z.number().int().min(1).max(20),
    builder: builderSelectionSchema.optional(),
    customization: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional()
  }).refine((item) => Boolean(item.productId) !== Boolean(item.builder), "Provide one product or builder selection.")).min(1).max(30)
});

async function priceOrderItems(input) {
  const pricedItems = [];
  for (const item of input.items) {
    if (item.productId) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, available: true, stock: { gt: 0 } }
      });
      if (!product) {
        const error = new Error("A product is unavailable or out of stock.");
        error.status = 409;
        throw error;
      }
      const selection = priceProductSelection(product, item.customization);
      pricedItems.push({
        productId: product.id,
        name: product.name,
        unitPriceCents: selection.unitPriceCents,
        quantity: item.quantity,
        customization: selection.customization
      });
    } else {
      const quote = await quoteBuilder(prisma, item.builder);
      pricedItems.push({
        productId: null,
        name: `Custom ${quote.kind} — ${quote.options.map((option) => option.name).join(", ")}`,
        unitPriceCents: quote.totalCents,
        quantity: item.quantity,
        customization: { kind: quote.kind, optionIds: quote.optionIds, options: quote.options }
      });
    }
  }
  return pricedItems;
}

async function assertFulfillmentConfiguration(transaction, fulfillment) {
  const activeSchedule = await transaction.fulfillmentSchedule.findUnique({
    where: { method: fulfillment.method },
    select: { active: true, updatedAt: true }
  });
  if (!activeSchedule?.active || activeSchedule.updatedAt.getTime() !== fulfillment.scheduleUpdatedAt.getTime()) {
    const error = new Error("Fulfilment scheduling changed. Please refresh and choose a new time.");
    error.status = 409;
    throw error;
  }
  if (fulfillment.method === "DELIVERY") {
    const zone = await transaction.deliveryZone.findUnique({
      where: { id: fulfillment.snapshot.deliveryZoneId },
      select: { active: true, feeCents: true, updatedAt: true }
    });
    if (!zone?.active || zone.feeCents !== fulfillment.feeCents ||
        zone.updatedAt.getTime() !== fulfillment.serviceUpdatedAt.getTime()) {
      const error = new Error("Delivery settings changed. Please refresh your order total.");
      error.status = 409;
      throw error;
    }
  } else {
    const location = await transaction.pickupLocation.findFirst({
      where: { id: "primary" },
      select: { active: true, updatedAt: true }
    });
    if (!location?.active || location.updatedAt.getTime() !== fulfillment.serviceUpdatedAt.getTime()) {
      const error = new Error("Pickup settings changed. Please refresh before checking out.");
      error.status = 409;
      throw error;
    }
  }
}

async function reserveAndCreateOrder(input, pricedItems, user, idempotencyKey, requestHash, fulfillment, reservationMinutes) {
  const subtotalCents = pricedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const totalCents = subtotalCents + fulfillment.feeCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) {
    const error = new Error("The checkout total exceeds the supported payment amount.");
    error.status = 400;
    throw error;
  }
  const orderNumber = `SW-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const reservationExpiresAt = new Date(Date.now() + reservationMinutes * 60000);
  return prisma.$transaction(async (transaction) => {
    await assertFulfillmentConfiguration(transaction, fulfillment);
    for (const item of pricedItems) {
      if (item.productId) {
        const result = await transaction.product.updateMany({
          where: { id: item.productId, available: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (result.count !== 1) {
          const error = new Error("A product just went out of stock. Please review your bag.");
          error.status = 409;
          throw error;
        }
      }
      if (item.customization?.optionIds) {
        for (const optionId of item.customization.optionIds) {
          const result = await transaction.builderOption.updateMany({
            where: { id: optionId, active: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } }
          });
          if (result.count !== 1) {
            const error = new Error("A selected ingredient just became unavailable. Please review your treat.");
            error.status = 409;
            throw error;
          }
        }
      }
    }
    const slot = await transaction.fulfillmentSlot.findUnique({
      where: { id: fulfillment.slotId },
      select: { capacity: true }
    });
    const slotReservation = slot ? await transaction.fulfillmentSlot.updateMany({
      where: {
        id: fulfillment.slotId,
        method: fulfillment.method,
        startsAt: fulfillment.startsAt,
        capacity: slot.capacity,
        reservedCount: { lt: slot.capacity }
      },
      data: { reservedCount: { increment: 1 } }
    }) : { count: 0 };
    if (slotReservation.count !== 1) {
      const error = new Error("That fulfilment time was just booked. Choose another slot.");
      error.status = 409;
      throw error;
    }
    return transaction.order.create({
      data: {
        orderNumber,
        userId: user?.id,
        email: user?.email || input.email,
        checkoutIdempotencyKey: idempotencyKey,
        checkoutRequestHash: requestHash,
        subtotalCents,
        deliveryFeeCents: fulfillment.feeCents,
        totalCents,
        ...fulfillment.snapshot,
        scheduledStartAt: fulfillment.startsAt,
        scheduledEndAt: fulfillment.endsAt,
        scheduleSlotId: fulfillment.slotId,
        reservationExpiresAt,
        reservationActive: true,
        currency: (process.env.PAYSTACK_CURRENCY || "ngn").toLowerCase(),
        items: { create: pricedItems.map(({ productId, name, unitPriceCents, quantity, customization }) => ({
          productId, productName: name, unitPriceCents, quantity, customization
        })) }
      },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        subtotalCents: true,
        deliveryFeeCents: true,
        totalCents: true,
        scheduleSlotId: true,
        reservationActive: true,
        currency: true,
        paymentReference: true,
        paymentAuthorizationUrl: true
      }
    });
  }, { isolationLevel: "Serializable" });
}

app.post("/api/checkout/quote", publicOperationLimit, async (request, response, next) => {
  try {
    const input = orderSchema.parse(request.body);
    const pricedItems = await priceOrderItems(input);
    const fulfillment = await resolveFulfillment(input);
    const subtotalCents = pricedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    if (!Number.isSafeInteger(subtotalCents + fulfillment.feeCents) || subtotalCents + fulfillment.feeCents > 2147483647) {
      const error = new Error("The checkout total exceeds the supported payment amount.");
      error.status = 400;
      throw error;
    }
    response.json({
      currency: "ngn",
      subtotalCents,
      deliveryFeeCents: fulfillment.feeCents,
      totalCents: subtotalCents + fulfillment.feeCents,
      scheduledStartAt: fulfillment.startsAt,
      scheduledEndAt: fulfillment.endsAt
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout/session", publicOperationLimit, optionalAuthentication, async (request, response, next) => {
  try {
    const reservationMinutes = assertCheckoutConfiguration();
    await expireFulfillmentReservations();
    const idempotencyKey = z.string().uuid().parse(request.get("idempotency-key"));
    const input = orderSchema.parse(request.body);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const existing = await prisma.order.findUnique({
      where: { checkoutIdempotencyKey: idempotencyKey },
      include: { items: true }
    });
    if (existing) {
      if (existing.email.toLowerCase() !== (request.auth?.user.email || input.email).toLowerCase() ||
          existing.userId !== (request.auth?.user.id || null) ||
          existing.checkoutRequestHash !== requestHash) {
        return response.status(409).json({ error: "This checkout request key is already in use." });
      }
      if (existing.paymentStatus !== "PENDING") {
        return response.status(409).json({ error: "This checkout is no longer available. Please start again." });
      }
      if (!existing.reservationActive || existing.reservationExpiresAt <= new Date()) {
        return response.status(409).json({ error: "This payment reservation expired. Please start checkout again." });
      }
      const payment = await initializeOrderPayment(existing, process.env.FRONTEND_ORIGIN || "http://localhost:5173");
      return response.status(200).json({ orderNumber: existing.orderNumber, checkoutUrl: payment.authorizationUrl });
    }
    const fulfillment = await resolveFulfillment(input);
    const pricedItems = await priceOrderItems(input);
    let order;
    try {
      order = await reserveAndCreateOrder(input, pricedItems, request.auth?.user, idempotencyKey, requestHash, fulfillment, reservationMinutes);
    } catch (error) {
      if (error.code !== "P2002") throw error;
      const concurrentOrder = await prisma.order.findUnique({
        where: { checkoutIdempotencyKey: idempotencyKey },
        include: { items: true }
      });
      if (!concurrentOrder) throw error;
      if (concurrentOrder.email.toLowerCase() !== (request.auth?.user.email || input.email).toLowerCase() ||
          concurrentOrder.userId !== (request.auth?.user.id || null) ||
          concurrentOrder.checkoutRequestHash !== requestHash) {
        return response.status(409).json({ error: "This checkout request key is already in use." });
      }
      if (concurrentOrder.paymentStatus !== "PENDING" || !concurrentOrder.reservationActive ||
          concurrentOrder.reservationExpiresAt <= new Date()) {
        return response.status(409).json({ error: "This checkout is no longer available. Please start again." });
      }
      const payment = await initializeOrderPayment(concurrentOrder, process.env.FRONTEND_ORIGIN || "http://localhost:5173");
      return response.status(200).json({ orderNumber: concurrentOrder.orderNumber, checkoutUrl: payment.authorizationUrl });
    }
    let payment;
    try {
      payment = await initializeOrderPayment(order, process.env.FRONTEND_ORIGIN || "http://localhost:5173");
    } catch (error) {
      if (!error.outcomeUnknown) {
        await prisma.$transaction(async (transaction) => {
          const reservedOrder = await transaction.order.findUnique({
            where: { id: order.id },
            include: { items: true }
          });
          const cancelled = await transaction.order.updateMany({
            where: { id: order.id, paymentStatus: "PENDING" },
            data: { paymentStatus: "FAILED", status: "CANCELLED", reservationActive: false }
          });
          if (cancelled.count !== 1) return;
          if (reservedOrder) await releaseOrderResources(transaction, reservedOrder);
          await transaction.orderStatusHistory.create({
            data: { orderId: order.id, fromStatus: "PENDING", toStatus: "CANCELLED", actorId: "checkout", reason: "Paystack transaction initialization failed." }
          });
        });
      }
      throw error;
    }
    try {
      response.status(201).json({ orderNumber: order.orderNumber, checkoutUrl: payment.authorizationUrl });
    } catch (error) {
      console.error("Paystack payment link was initialized but checkout response could not be completed.");
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/payments/verify/:reference", async (request, response, next) => {
  try {
    const reference = z.string().regex(/^KK-[a-f0-9]{36}$/i).parse(request.params.reference);
    const attempt = await prisma.paymentAttempt.findUnique({ where: { reference }, include: { order: true } });
    const order = attempt?.order || await prisma.order.findUnique({ where: { paymentReference: reference } });
    if (!order) return response.status(404).json({ error: "Order not found." });
    const verified = await verifyPaystackTransaction(reference);
    if (verified.status === "success") await settleOrderByReference(reference, verified);
    else if (verified.status === "failed") await releaseOrderByReference(reference, verified);
    const current = await prisma.order.findUnique({
      where: { id: order.id },
      select: { orderNumber: true, status: true, paymentStatus: true }
    });
    response.json(current);
  } catch (error) {
    next(error);
  }
});

app.post("/api/newsletter", publicOperationLimit, async (request, response, next) => {
  try {
    const input = z.object({
      email: z.string().trim().email().max(254),
      consent: z.literal(true)
    }).parse(request.body);
    await prisma.newsletterSubscriber.upsert({
      where: { email: input.email.toLowerCase() },
      update: {},
      create: { email: input.email.toLowerCase() }
    });
    response.status(201).json({ subscribed: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    return response.status(400).json({ error: "Invalid request.", details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
  }
  if (error.code === "P2034") {
    return response.status(409).json({ error: "Inventory or fulfilment capacity changed during checkout. Please try again." });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    if (process.env.NODE_ENV === "production") console.error("API request failed.", { code: error.code || "INTERNAL" });
    else console.error("API request failed:", error);
  }
  const safeMessage = status >= 500 &&
    (process.env.NODE_ENV === "production" || !error.expose)
    ? "The service is temporarily unavailable."
    : error.message;
  return response.status(status).json({ error: safeMessage });
});

export default app;
