import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingConfirmationBlockedMessage,
  bookingStatusTransitionError
} from "../src/booking-workflow.js";

test("event confirmation stays blocked until launch policies can be enforced", () => {
  for (const currentStatus of ["AWAITING_CUSTOMER_APPROVAL", "AWAITING_DEPOSIT", "CANCELLATION_REQUESTED"]) {
    assert.equal(bookingStatusTransitionError(currentStatus, "CONFIRMED"), bookingConfirmationBlockedMessage);
  }
});

test("event workflow allows review steps but rejects unrelated transitions", () => {
  assert.equal(bookingStatusTransitionError("REQUESTED", "UNDER_REVIEW"), null);
  assert.equal(bookingStatusTransitionError("UNDER_REVIEW", "QUOTE_SENT"), null);
  assert.equal(bookingStatusTransitionError("REQUESTED", "COMPLETED"), "This booking status transition is not allowed.");
});
