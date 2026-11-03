import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhook
} from "../src/payments.js";

test("Paystack initializes an NGN transaction with the exact kobo amount and order metadata", async (t) => {
  const previousCurrency = process.env.PAYSTACK_CURRENCY;
  const previousSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.PAYSTACK_CURRENCY;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_placeholder";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.paystack.co/transaction/initialize");
    assert.equal(options.headers.Authorization, "Bearer sk_test_placeholder");
    const body = JSON.parse(options.body);
    assert.equal(body.amount, 12500);
    assert.equal(body.currency, "ngn");
    assert.equal(body.email, "customer@example.com");
    assert.equal(body.reference, "KK-0123456789abcdef0123456789abcdef0123");
    assert.deepEqual(body.metadata, { orderId: "order-1", orderNumber: "KK-1001" });
    assert.equal(new URL(body.callback_url).searchParams.get("reference"), body.reference);
    return new Response(JSON.stringify({
      status: true,
      data: {
        reference: body.reference,
        authorization_url: "https://checkout.paystack.com/example"
      }
    }), { status: 200 });
  };
  t.after(() => {
    if (previousCurrency === undefined) delete process.env.PAYSTACK_CURRENCY;
    else process.env.PAYSTACK_CURRENCY = previousCurrency;
    if (previousSecretKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecretKey;
    globalThis.fetch = previousFetch;
  });

  const payment = await initializePaystackTransaction({
    id: "order-1",
    orderNumber: "KK-1001",
    email: "customer@example.com",
    subtotalCents: 12500,
    currency: "ngn"
  }, "https://shop.example", "KK-0123456789abcdef0123456789abcdef0123");
  assert.deepEqual(payment, {
    reference: "KK-0123456789abcdef0123456789abcdef0123",
    authorizationUrl: "https://checkout.paystack.com/example"
  });
});

test("Paystack webhook signature accepts a signed raw payload", () => {
  const secret = "sk_test_signature";
  const payload = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "KK-test" } }));
  const signature = createHmac("sha512", secret).update(payload).digest("hex");
  process.env.PAYSTACK_SECRET_KEY = secret;
  assert.equal(verifyPaystackWebhook(payload, signature).event, "charge.success");
});

test("Paystack verifies the transaction reference on the server", async (t) => {
  const previousSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_placeholder";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.paystack.co/transaction/verify/KK-reference");
    assert.equal(options.headers.Authorization, "Bearer sk_test_placeholder");
    return new Response(JSON.stringify({
      status: true,
      data: { reference: "KK-reference", status: "success", amount: 12500, currency: "NGN" }
    }), { status: 200 });
  };
  t.after(() => {
    if (previousSecretKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecretKey;
    globalThis.fetch = previousFetch;
  });

  const verified = await verifyPaystackTransaction("KK-reference");
  assert.equal(verified.status, "success");
  assert.equal(verified.amount, 12500);
});

test("Paystack webhook signature rejects tampering and malformed signatures", () => {
  const secret = "sk_test_signature";
  const payload = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", secret).update(payload).digest("hex");
  process.env.PAYSTACK_SECRET_KEY = secret;
  assert.throws(() => verifyPaystackWebhook(Buffer.from("{}"), signature), { status: 400 });
  assert.throws(() => verifyPaystackWebhook(payload, "not-a-signature"), { status: 400 });
});
