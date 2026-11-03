import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

function requirePaystackConfig() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const error = new Error("Online checkout is not configured. Please contact the shop.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
}

async function paystackRequest(path, options = {}) {
  requirePaystackConfig();
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    },
    signal: AbortSignal.timeout(10000)
  });
  let result;
  try {
    result = await response.json();
  } catch {
    console.error("Paystack API returned an invalid response:", response.status);
    const error = new Error("Secure payment could not be completed. Please try again.");
    error.status = 502;
    throw error;
  }
  if (!response.ok || result?.status !== true || !result.data || typeof result.data !== "object") {
    console.error("Paystack API request failed:", result?.message || response.status);
    const error = new Error("Secure payment could not be completed. Please try again.");
    error.status = 502;
    throw error;
  }
  return result.data;
}

export function createPaymentReference() {
  return `KK-${randomBytes(18).toString("hex")}`;
}

export async function initializePaystackTransaction(order, origin, reference = createPaymentReference()) {
  const currency = (process.env.PAYSTACK_CURRENCY || "ngn").toLowerCase();
  if (currency !== "ngn" || order.currency.toLowerCase() !== currency) {
    const error = new Error("Paystack checkout is configured for Nigerian naira only.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  const data = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: order.email,
      amount: Number.isInteger(order.totalCents) ? order.totalCents : order.subtotalCents,
      currency,
      reference,
      callback_url: `${origin}/?checkout=success&reference=${encodeURIComponent(reference)}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber
      }
    })
  });
  if (data.reference !== reference || !data.authorization_url) {
    const error = new Error("Paystack did not return a valid payment link.");
    error.status = 502;
    throw error;
  }
  return { reference: data.reference, authorizationUrl: data.authorization_url };
}

export async function verifyPaystackTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function verifyPaystackWebhook(payload, signatureHeader) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const error = new Error("Payment verification is not configured.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  if (!Buffer.isBuffer(payload) || typeof signatureHeader !== "string" ||
      !/^[a-f0-9]{128}$/i.test(signatureHeader)) {
    const error = new Error("Invalid payment webhook signature.");
    error.status = 400;
    throw error;
  }
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest();
  const candidate = Buffer.from(signatureHeader, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    const error = new Error("Invalid payment webhook signature.");
    error.status = 400;
    throw error;
  }
  try {
    return JSON.parse(payload.toString("utf8"));
  } catch {
    const error = new Error("Invalid Paystack webhook payload.");
    error.status = 400;
    throw error;
  }
}
