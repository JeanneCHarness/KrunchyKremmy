import { escapeHtml, sendTransactionalEmail } from "./email.js";
import { formatNaira } from "./currency.js";

const notificationContent = {
  PAYMENT_CONFIRMED: { subject: "KrunchyKremmy order confirmed", heading: "Payment confirmed" },
  ORDER_PREPARING: { subject: "Your KrunchyKremmy order is being prepared", heading: "Your order is being prepared" },
  PICKUP_READY: { subject: "Your KrunchyKremmy pickup is ready", heading: "Ready for pickup" },
  DELIVERY_DISPATCHED: { subject: "Your KrunchyKremmy order is on its way", heading: "Order dispatched" },
  ORDER_DELIVERED: { subject: "Your KrunchyKremmy order was delivered", heading: "Order delivered" },
  ORDER_COLLECTED: { subject: "Your KrunchyKremmy order was collected", heading: "Order collected" },
  ORDER_CANCELLED: { subject: "Your KrunchyKremmy order was cancelled", heading: "Order cancelled" }
};

function scheduledWindow(order) {
  if (!order.scheduledStartAt || !order.scheduledEndAt || !order.fulfillmentTimeZone) return "Not scheduled";
  const options = { timeZone: order.fulfillmentTimeZone, dateStyle: "medium", timeStyle: "short" };
  return `${new Intl.DateTimeFormat("en-NG", options).format(order.scheduledStartAt)} – ${new Intl.DateTimeFormat("en-NG", {
    timeZone: order.fulfillmentTimeZone, timeStyle: "short"
  }).format(order.scheduledEndAt)}`;
}

function orderSummary(order, content) {
  const customerName = escapeHtml(order.recipientName || "Customer");
  const orderNumber = escapeHtml(order.orderNumber);
  const fulfillment = order.fulfillmentMethod === "DELIVERY"
    ? `Home delivery to ${escapeHtml([
      order.deliveryAddress, order.deliveryBuilding, order.deliveryNeighborhood, order.deliveryZoneName
    ].filter(Boolean).join(", "))}`
    : order.fulfillmentMethod === "PICKUP"
      ? `Customer pickup at ${escapeHtml(order.pickupLocationAddress || order.pickupLocationName || "the configured pickup location")}`
      : "Online order";
  const items = order.items.map((item) =>
    `<li>${item.quantity} × ${escapeHtml(item.productName)}</li>`
  ).join("");
  const supportContact = order.pickupLocationPhone
    ? `<p>For assistance, contact ${escapeHtml(order.pickupLocationPhone)}.</p>`
    : "";
  const reconciliationNotice = order.status === "PAYMENT_REVIEW"
    ? "<p>Your payment was received after the fulfilment reservation expired. Our team will contact you to confirm next steps.</p>"
    : "";
  return `<p>Hello ${customerName},</p><h2>${content.heading}</h2><p>Order <strong>${orderNumber}</strong></p><ul>${items}</ul><p>Payment: ${escapeHtml(order.paymentStatus)}</p><p>Fulfilment: ${fulfillment}</p><p>Scheduled: ${escapeHtml(scheduledWindow(order))}</p><p>Delivery fee: ${formatNaira(order.deliveryFeeCents)}</p><p>Total: ${formatNaira(order.totalCents)}</p>${reconciliationNotice}${supportContact}`;
}

export async function sendOrderNotification(prisma, orderId, type, { retry = false } = {}) {
  const content = notificationContent[type];
  if (!content) throw new Error("Unsupported order notification type.");
  const notification = await prisma.orderNotification.upsert({
    where: { orderId_type: { orderId, type } },
    create: { orderId, type },
    update: {}
  });
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const claim = await prisma.orderNotification.updateMany({
    where: {
      id: notification.id,
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        ...(retry ? [{ status: "SENDING", lastAttemptAt: { lte: staleBefore } }] : [])
      ]
    },
    data: { status: "SENDING", attempts: { increment: 1 }, lastAttemptAt: new Date(), lastError: null }
  });
  if (!claim.count) return prisma.orderNotification.findUnique({ where: { id: notification.id } });

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new Error("Order was not found for notification.");
    await sendTransactionalEmail({
      to: order.email,
      subject: content.subject,
      html: orderSummary(order, content)
    });
    return prisma.orderNotification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date(), lastError: null }
    });
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed.";
    console.error("Order notification delivery failed:", { orderId, type, message: failureMessage });
    return prisma.orderNotification.update({
      where: { id: notification.id },
      data: { status: "FAILED", lastError: failureMessage }
    });
  }
}
