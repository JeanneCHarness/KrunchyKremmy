export const bookingConfirmationBlockedMessage =
  "Booking confirmation is disabled until availability, customer acceptance, and deposit/payment requirements can be verified.";

const bookingTransitions = {
  REQUESTED: new Set(["UNDER_REVIEW", "DECLINED"]),
  UNDER_REVIEW: new Set(["QUOTE_SENT", "DECLINED"]),
  QUOTE_SENT: new Set(["AWAITING_CUSTOMER_APPROVAL", "UNDER_REVIEW", "DECLINED"]),
  AWAITING_CUSTOMER_APPROVAL: new Set(["AWAITING_DEPOSIT", "DECLINED"]),
  AWAITING_DEPOSIT: new Set(["DECLINED"]),
  CONFIRMED: new Set(["IN_PREPARATION", "CANCELLATION_REQUESTED"]),
  IN_PREPARATION: new Set(["COMPLETED", "CANCELLATION_REQUESTED"]),
  CANCELLATION_REQUESTED: new Set(["CANCELLED", "CONFIRMED"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
  DECLINED: new Set()
};

export function bookingStatusTransitionError(currentStatus, nextStatus) {
  if (nextStatus === "CONFIRMED") return bookingConfirmationBlockedMessage;
  return bookingTransitions[currentStatus]?.has(nextStatus)
    ? null
    : "This booking status transition is not allowed.";
}
