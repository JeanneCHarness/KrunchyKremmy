import test from "node:test";
import assert from "node:assert/strict";
import { bookingRequestHash, bookingSchema, validateBookingTime, validateServiceCustomization } from "../src/event-bookings.js";

const futureStart = new Date(Date.now() + 30 * 86400000);
futureStart.setMinutes(0, 0, 0);
const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);

const validRequest = {
  idempotencyKey: "70f6b6d9-9b34-4da5-8a36-811ed59a5df6",
  eventTypeSlug: "birthdays",
  startsAt: futureStart.toISOString(),
  endsAt: futureEnd.toISOString(),
  timeZone: "Europe/London",
  guestCount: 30,
  services: [{ serviceId: "service-1", servings: 30, customization: { iceCreamFlavors: ["Vanilla bean"] } }],
  venueType: "EVENT_HALL",
  address: "12 Sweet Street",
  city: "London",
  setupType: "INDOOR",
  customerName: "Alex Treat",
  customerEmail: "alex@example.com",
  customerPhone: "+442079460123",
  contactMethod: "EMAIL",
  termsAccepted: true,
  honeypot: ""
};

test("booking request accepts valid quote-only event details", () => {
  const parsed = bookingSchema.parse({ ...validRequest, budgetRange: "$250–$500" });
  assert.equal(parsed.guestCount, 30);
  assert.equal(parsed.services[0].customization.needsAssistance, false);
  assert.equal(parsed.budgetRange, "$250–$500");
});

test("booking idempotency accepts new 256-bit keys while preserving UUID compatibility", () => {
  assert.equal(bookingSchema.safeParse({ ...validRequest, idempotencyKey: "a".repeat(64) }).success, true);
  assert.equal(bookingSchema.safeParse({ ...validRequest, idempotencyKey: "a".repeat(63) }).success, false);
  assert.equal(bookingSchema.safeParse(validRequest).success, true);
});

test("booking request hashes bind a key to its payload but exclude the key itself", () => {
  const first = bookingRequestHash(bookingSchema.parse(validRequest));
  const replay = bookingRequestHash(bookingSchema.parse({ ...validRequest, idempotencyKey: "a".repeat(64) }));
  const changed = bookingRequestHash(bookingSchema.parse({ ...validRequest, customerName: "Jamie Treat" }));
  assert.equal(first, replay);
  assert.notEqual(first, changed);
});

test("booking requires service selection and explicit terms acceptance", () => {
  assert.equal(bookingSchema.safeParse({ ...validRequest, services: [] }).success, false);
  assert.equal(bookingSchema.safeParse({ ...validRequest, termsAccepted: false }).success, false);
});

test("event date must be future, ordered, and no longer than sixteen hours", () => {
  assert.throws(() => validateBookingTime({
    startsAt: new Date(Date.now() - 1000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    timeZone: "UTC"
  }), { status: 400 });
  assert.throws(() => validateBookingTime({
    startsAt: futureStart.toISOString(),
    endsAt: new Date(futureStart.getTime() - 3600000).toISOString(),
    timeZone: "UTC"
  }), { status: 400 });
  assert.throws(() => validateBookingTime({
    startsAt: futureStart.toISOString(),
    endsAt: new Date(futureStart.getTime() + 17 * 3600000).toISOString(),
    timeZone: "UTC"
  }), { status: 400 });
});

test("service customizations must match configured options", () => {
  validateServiceCustomization({ iceCreamFlavors: ["Vanilla bean"], needsAssistance: false }, {
    iceCreamFlavors: ["Vanilla bean", "Pistachio"]
  });
  assert.throws(() => validateServiceCustomization({ iceCreamFlavors: ["Unavailable"] }, {
    iceCreamFlavors: ["Vanilla bean"]
  }), { status: 409 });
  assert.throws(() => validateServiceCustomization({ popcornFlavors: ["Caramel"] }, {
    iceCreamFlavors: ["Vanilla bean"]
  }), { status: 400 });
});
