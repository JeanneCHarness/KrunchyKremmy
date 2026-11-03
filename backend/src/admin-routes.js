import { Router } from "express";
import { z } from "zod";
import { sendTransactionalEmail } from "./email.js";
import { bookingStatusTransitionError } from "./booking-workflow.js";
import { formatNaira } from "./currency.js";
import { isValidTimeZone } from "./fulfillment.js";
import { sendOrderNotification } from "./order-notifications.js";

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional()
});

const customizationOptionSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["choice", "text"]).default("choice"),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(500).optional(),
  choices: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    priceCents: z.number().int().min(0).max(100000000)
  }).strict()).max(100).default([])
}).strict();

const productFields = {
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().min(1).max(3000).optional(),
  priceCents: z.number().int().min(0).max(100000000).optional(),
  stock: z.number().int().min(0).max(10000000).optional(),
  imageUrl: z.string().trim().min(1).max(1000).optional(),
  customizationOptions: z.array(customizationOptionSchema).max(30).nullable().optional(),
  featured: z.boolean().optional(),
  available: z.boolean().optional(),
  categoryId: z.string().min(1).optional()
};

const categoryFields = {
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().min(1).max(1000).optional(),
  imageUrl: z.string().trim().min(1).max(1000).optional(),
  active: z.boolean().optional()
};

function safeFailure(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapDatabaseError(error, next, response) {
  if (error.code === "P2002") return response.status(409).json({ error: "A record with that name or slug already exists." });
  if (error.code === "P2003") return response.status(400).json({ error: "The selected related record does not exist." });
  next(error);
}

export function createAdminRouter(prisma, requireAdministrator) {
  const router = Router();
  router.use(requireAdministrator);

  router.get("/security/events", async (_request, response, next) => {
    try {
      const events = await prisma.securityEvent.findMany({
        select: { id: true, type: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100
      });
      response.json({ events });
    } catch (error) {
      next(error);
    }
  });

  const deliveryZoneSchema = z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(1000).default(""),
    neighborhoods: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
    feeCents: z.number().int().min(0).max(100000000),
    estimatedDurationMinutes: z.number().int().min(1).max(10080),
    minimumLeadMinutes: z.number().int().min(0).max(10080).default(0),
    active: z.boolean().default(false)
  }).strict();
  const pickupLocationSchema = z.object({
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(500),
    neighborhood: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(120),
    directions: z.string().trim().max(1000).nullable().optional(),
    instructions: z.string().trim().max(1000).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    active: z.boolean().default(false)
  }).strict();
  const scheduleSchema = z.object({
    timeZone: z.string().trim().min(1).max(100).refine(isValidTimeZone, "Choose a valid business timezone."),
    operatingDays: z.array(z.number().int().min(0).max(6)).max(7),
    startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    slotDurationMinutes: z.number().int().min(5).max(1440),
    maximumOrdersPerSlot: z.number().int().min(1).max(10000),
    cutoffMinutes: z.number().int().min(0).max(10080).default(0),
    minimumLeadMinutes: z.number().int().min(0).max(10080),
    maximumHorizonDays: z.number().int().min(1).max(365).default(30),
    active: z.boolean().default(false)
  }).strict().refine((value) => value.endTime > value.startTime, {
    message: "The end time must be later than the start time.",
    path: ["endTime"]
  }).refine((value) => !value.active || value.operatingDays.length > 0, {
    message: "Select at least one operating day before enabling this schedule.",
    path: ["operatingDays"]
  });

  router.get("/order-notifications", async (_request, response, next) => {
    try {
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
      const notifications = await prisma.orderNotification.findMany({
        where: {
          OR: [
            { status: { in: ["FAILED", "PENDING"] } },
            { status: "SENDING", lastAttemptAt: { lte: staleBefore } }
          ]
        },
        include: { order: { select: { id: true, orderNumber: true, email: true } } },
        orderBy: { updatedAt: "asc" },
        take: 100
      });
      response.json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  router.get("/payments/reconciliation", async (_request, response, next) => {
    try {
      const attempts = await prisma.paymentAttempt.findMany({
        where: { reconciliationRequired: true },
        include: { order: { select: { id: true, orderNumber: true, email: true, status: true, paymentStatus: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100
      });
      response.json({ attempts });
    } catch (error) {
      next(error);
    }
  });

  router.post("/order-notifications/:id/retry", async (request, response, next) => {
    try {
      const notification = await prisma.orderNotification.findUnique({
        where: { id: request.params.id },
        select: { orderId: true, type: true }
      });
      if (!notification) return response.status(404).json({ error: "Order notification not found." });
      const result = await sendOrderNotification(prisma, notification.orderId, notification.type, { retry: true });
      response.json({ notification: result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/fulfillment/zones", async (_request, response, next) => {
    try {
      const zones = await prisma.deliveryZone.findMany({
        include: { _count: { select: { orders: true } } },
        orderBy: { name: "asc" }
      });

      response.json({ zones });
    } catch (error) {
      next(error);
    }
  });

  router.post("/fulfillment/zones", async (request, response, next) => {
    try {
      const input = deliveryZoneSchema.parse(request.body);
      const zone = await prisma.deliveryZone.create({ data: input });
      response.status(201).json({ zone });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.patch("/fulfillment/zones/:id", async (request, response, next) => {
    try {
      const input = deliveryZoneSchema.partial().strict().refine((value) => Object.keys(value).length > 0).parse(request.body);
      const update = await prisma.deliveryZone.updateMany({ where: { id: request.params.id }, data: input });
      if (!update.count) return response.status(404).json({ error: "Delivery zone not found." });
      response.json({ zone: await prisma.deliveryZone.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { orders: true } } }
      }) });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.delete("/fulfillment/zones/:id", async (request, response, next) => {
    try {
      const zone = await prisma.deliveryZone.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { orders: true } } }
      });
      if (!zone) return response.status(404).json({ error: "Delivery zone not found." });
      if (zone._count.orders) return response.status(409).json({ error: "This zone has historical orders. Deactivate it instead." });
      await prisma.deliveryZone.delete({ where: { id: zone.id } });
      response.status(204).end();
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/fulfillment/pickup-location", async (_request, response, next) => {
    try {
      response.json({ pickupLocation: await prisma.pickupLocation.findUnique({ where: { id: "primary" } }) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/fulfillment/pickup-location", async (request, response, next) => {
    try {
      const input = pickupLocationSchema.parse(request.body);
      const pickupLocation = await prisma.pickupLocation.upsert({
        where: { id: "primary" },
        create: { id: "primary", ...input },
        update: input
      });
      response.json({ pickupLocation });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/fulfillment/schedules", async (_request, response, next) => {
    try {
      const [schedules, blackouts] = await Promise.all([
        prisma.fulfillmentSchedule.findMany({ orderBy: { method: "asc" } }),
        prisma.fulfillmentBlackoutDate.findMany({ orderBy: { startsAt: "asc" } })
      ]);
      response.json({ schedules, blackouts });
    } catch (error) {
      next(error);
    }
  });

  router.put("/fulfillment/schedules/:method", async (request, response, next) => {
    try {
      const method = z.enum(["DELIVERY", "PICKUP"]).parse(request.params.method.toUpperCase());
      const input = scheduleSchema.parse(request.body);
      const current = await prisma.fulfillmentSchedule.findUnique({ where: { method } });
      if (current) {
        const upcomingReservations = await prisma.fulfillmentSlot.count({
          where: { method, startsAt: { gte: new Date() }, reservedCount: { gt: 0 } }
        });
        const schedulingFields = [
          "timeZone", "operatingDays", "startTime", "endTime", "slotDurationMinutes",
          "maximumOrdersPerSlot", "cutoffMinutes", "minimumLeadMinutes", "maximumHorizonDays"
        ];
        const changed = schedulingFields.some((field) =>
          JSON.stringify(current[field]) !== JSON.stringify(input[field])
        );
        if (upcomingReservations && changed) {
          return response.status(409).json({
            error: "Scheduling rules cannot change while upcoming orders hold capacity. Deactivate the schedule or wait until those reservations pass."
          });
        }
      }
      const schedule = await prisma.fulfillmentSchedule.upsert({
        where: { method },
        create: { method, ...input },
        update: input
      });
      response.json({ schedule });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.post("/fulfillment/blackouts", async (request, response, next) => {
    try {
      const input = z.object({
        method: z.enum(["DELIVERY", "PICKUP"]).nullable().optional(),
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }),
        reason: z.string().trim().max(500).optional()
      }).strict().refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
        message: "The blackout end must be after its start.",
        path: ["endsAt"]
      }).parse(request.body);
      const blackout = await prisma.fulfillmentBlackoutDate.create({
        data: { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }
      });
      response.status(201).json({ blackout });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.delete("/fulfillment/blackouts/:id", async (request, response, next) => {
    try {
      const result = await prisma.fulfillmentBlackoutDate.deleteMany({ where: { id: request.params.id } });
      if (!result.count) return response.status(404).json({ error: "Blackout date not found." });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/categories", async (_request, response, next) => {
    try {
      const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
      response.json({ categories });
    } catch (error) {
      next(error);
    }
  });

  router.post("/categories", async (request, response, next) => {
    try {
      const input = z.object(categoryFields).strict().refine((value) => Object.keys(value).length > 0).parse(request.body);
      const category = await prisma.category.create({ data: { ...input, active: input.active ?? true } });
      response.status(201).json({ category });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.patch("/categories/:id", async (request, response, next) => {
    try {
      const input = z.object(categoryFields).strict().refine((value) => Object.keys(value).length > 0).parse(request.body);
      const result = await prisma.category.updateMany({ where: { id: request.params.id }, data: input });
      if (!result.count) return response.status(404).json({ error: "Category not found." });
      response.json({ category: await prisma.category.findUnique({ where: { id: request.params.id } }) });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/products", async (request, response, next) => {
    try {
      const query = pageQuery.parse(request.query);
      const where = query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { slug: { contains: query.search, mode: "insensitive" } }
        ]
      } : {};
      const [products, total] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          include: { category: { select: { id: true, name: true, slug: true } } },
          orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
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

  router.post("/products", async (request, response, next) => {
    try {
      const input = z.object({
        ...productFields,
        name: productFields.name.unwrap(),
        slug: productFields.slug.unwrap(),
        description: productFields.description.unwrap(),
        priceCents: productFields.priceCents.unwrap(),
        stock: productFields.stock.unwrap(),
        imageUrl: productFields.imageUrl.unwrap(),
        categoryId: productFields.categoryId.unwrap()
      }).strict().parse(request.body);
      const product = await prisma.product.create({ data: { ...input, available: input.available ?? true } });
      response.status(201).json({ product });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.patch("/products/:id", async (request, response, next) => {
    try {
      const input = z.object(productFields).strict().refine((value) => Object.keys(value).length > 0).parse(request.body);
      const updated = await prisma.product.updateMany({ where: { id: request.params.id }, data: input });
      if (!updated.count) return response.status(404).json({ error: "Product not found." });
      response.json({ product: await prisma.product.findUnique({ where: { id: request.params.id }, include: { category: true } }) });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/orders", async (request, response, next) => {
    try {
      const query = pageQuery.parse(request.query);
      const filters = z.object({
        status: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COLLECTED", "PAYMENT_REVIEW"]).optional(),
        paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
        fulfillmentMethod: z.enum(["DELIVERY", "PICKUP"]).optional()
      }).parse(request.query);
      const where = {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
        ...(filters.fulfillmentMethod ? { fulfillmentMethod: filters.fulfillmentMethod } : {}),
        ...(query.search ? {
          OR: [
            { orderNumber: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } }
          ]
        } : {})
      };
      const [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            email: true,
            status: true,
            paymentStatus: true,
            subtotalCents: true,
            deliveryFeeCents: true,
            totalCents: true,
            currency: true,
            fulfillmentMethod: true,
            fulfillmentTimeZone: true,
            deliveryZoneName: true,
            deliveryNeighborhood: true,
            recipientName: true,
            recipientPhone: true,
            deliveryAddress: true,
            deliveryBuilding: true,
            deliveryLandmark: true,
            deliveryInstructions: true,
            pickupLocationName: true,
            pickupLocationAddress: true,
            pickupLocationPhone: true,
            pickupInstructions: true,
            scheduledStartAt: true,
            scheduledEndAt: true,
            customerNotes: true,
            assignedRiderName: true,
            riderContact: true,
            dispatchNotes: true,
            trackingReference: true,
            dispatchedAt: true,
            completedAt: true,
            createdAt: true,
            items: { select: { id: true, productName: true, quantity: true, customization: true } },
            statusHistory: { orderBy: { createdAt: "asc" } }
          },
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.order.count({ where })
      ]);
      response.json({ orders, page: query.page, limit: query.limit, total });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/orders/:id/status", async (request, response, next) => {
    try {
      const { status, reason } = z.object({
        status: z.enum(["PREPARING", "READY", "COMPLETED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COLLECTED"]),
        reason: z.string().trim().max(500).optional()
      }).strict().parse(request.body);
      const result = await prisma.$transaction(async (transaction) => {
        const order = await transaction.order.findUnique({ where: { id: request.params.id } });
        if (!order) throw safeFailure("Order not found.", 404);
        if (order.paymentStatus !== "PAID") throw safeFailure("An unpaid order cannot enter fulfilment.", 409);
        const nextByStatus = {
          CONFIRMED: "PREPARING",
          PREPARING: order.fulfillmentMethod === "PICKUP" ? "READY_FOR_PICKUP" : order.fulfillmentMethod === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY",
          READY: "COMPLETED",
          READY_FOR_PICKUP: "COLLECTED",
          OUT_FOR_DELIVERY: "DELIVERED"
        };
        if (nextByStatus[order.status] !== status) throw safeFailure("This order status transition is not allowed.", 409);
        if (status === "READY_FOR_PICKUP" && order.fulfillmentMethod !== "PICKUP") {
          throw safeFailure("Ready for pickup is only valid for pickup orders.", 409);
        }
        if (["OUT_FOR_DELIVERY", "DELIVERED"].includes(status) && order.fulfillmentMethod !== "DELIVERY") {
          throw safeFailure("Delivery statuses are only valid for delivery orders.", 409);
        }
        if (status === "COLLECTED" && order.fulfillmentMethod !== "PICKUP") {
          throw safeFailure("Collected is only valid for pickup orders.", 409);
        }
        await transaction.order.update({
          where: { id: order.id },
          data: {
            status,
            ...(status === "OUT_FOR_DELIVERY" ? { dispatchedAt: new Date() } : {}),
            ...(["DELIVERED", "COLLECTED", "COMPLETED"].includes(status) ? { completedAt: new Date() } : {})
          }
        });
        await transaction.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: order.status, toStatus: status, actorId: request.auth.user.id, reason }
        });
        return transaction.order.findUnique({
          where: { id: order.id },
          select: {
            id: true,
            orderNumber: true,
            email: true,
            status: true,
            paymentStatus: true,
            subtotalCents: true,
            deliveryFeeCents: true,
            totalCents: true,
            currency: true,
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
            scheduledStartAt: true,
            scheduledEndAt: true,
            customerNotes: true,
            assignedRiderName: true,
            riderContact: true,
            dispatchNotes: true,
            trackingReference: true,
            dispatchedAt: true,
            completedAt: true,
            createdAt: true,
            items: { select: { id: true, productName: true, quantity: true, customization: true } },
            statusHistory: { orderBy: { createdAt: "asc" } }
          }
        });
      });
      const notificationType = {
        PREPARING: "ORDER_PREPARING",
        READY_FOR_PICKUP: "PICKUP_READY",
        OUT_FOR_DELIVERY: "DELIVERY_DISPATCHED",
        DELIVERED: "ORDER_DELIVERED",
        COLLECTED: "ORDER_COLLECTED"
      }[status];
      const notification = notificationType
        ? await sendOrderNotification(prisma, result.id, notificationType)
        : null;
      response.json({ order: result, notificationStatus: notification?.status || null });
    } catch (error) {
      if (error.status) return response.status(error.status).json({ error: error.message });
      mapDatabaseError(error, next, response);
    }
  });

  router.patch("/orders/:id/dispatch", async (request, response, next) => {
    try {
      const input = z.object({
        assignedRiderName: z.string().trim().max(120).nullable().optional(),
        riderContact: z.string().trim().max(40).nullable().optional(),
        dispatchNotes: z.string().trim().max(1000).nullable().optional(),
        trackingReference: z.string().trim().max(120).nullable().optional()
      }).strict().refine((value) => Object.keys(value).length > 0).parse(request.body);
      const order = await prisma.order.findUnique({ where: { id: request.params.id } });
      if (!order) return response.status(404).json({ error: "Order not found." });
      if (order.fulfillmentMethod !== "DELIVERY") {
        return response.status(409).json({ error: "Dispatch details are only valid for delivery orders." });
      }
      const updated = await prisma.order.update({ where: { id: order.id }, data: input });
      response.json({ order: updated });
    } catch (error) {
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/bookings", async (request, response, next) => {
    try {
      const query = pageQuery.parse(request.query);
      const where = query.search ? {
        OR: [
          { reference: { contains: query.search, mode: "insensitive" } },
          { customerName: { contains: query.search, mode: "insensitive" } },
          { customerEmail: { contains: query.search, mode: "insensitive" } }
        ]
      } : {};
      const [bookings, total] = await prisma.$transaction([
        prisma.booking.findMany({
          where,
          include: {
            eventType: true,
            services: true,
            quotations: { orderBy: { version: "desc" } },
            history: { orderBy: { createdAt: "asc" } }
          },
          orderBy: { startsAt: "asc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.booking.count({ where })
      ]);
      response.json({ bookings, page: query.page, limit: query.limit, total });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/bookings/:id/status", async (request, response, next) => {
    try {
      const { status, reason } = z.object({
        status: z.enum(["UNDER_REVIEW", "AWAITING_CUSTOMER_APPROVAL", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PREPARATION", "COMPLETED", "CANCELLED", "DECLINED", "CANCELLATION_REQUESTED"]),
        reason: z.string().trim().min(1).max(1000)
      }).strict().parse(request.body);
      const booking = await prisma.$transaction(async (transaction) => {
        const current = await transaction.booking.findUnique({ where: { id: request.params.id } });
        if (!current) throw safeFailure("Booking not found.", 404);
        const transitionError = bookingStatusTransitionError(current.status, status);
        if (transitionError) throw safeFailure(transitionError, 409);
        await transaction.booking.update({ where: { id: current.id }, data: { status } });
        await transaction.bookingStatusHistory.create({
          data: { bookingId: current.id, fromStatus: current.status, toStatus: status, actorId: request.auth.user.id, reason }
        });
        return transaction.booking.findUnique({ where: { id: current.id }, include: { eventType: true, services: true, history: { orderBy: { createdAt: "asc" } } } });
      });
      response.json({ booking });
    } catch (error) {
      if (error.status) return response.status(error.status).json({ error: error.message });
      mapDatabaseError(error, next, response);
    }
  });

  router.post("/bookings/:id/quotations", async (request, response, next) => {
    try {
      const input = z.object({
        amountCents: z.number().int().positive().max(100000000),
        currency: z.string().trim().toLowerCase().refine((value) => value === "ngn", "Only NGN quotations are supported."),
        items: z.array(z.object({
          description: z.string().trim().min(1).max(500),
          amountCents: z.number().int().min(0).max(100000000)
        }).strict()).min(1).max(30),
        depositCents: z.number().int().min(0).max(100000000).optional(),
        validUntil: z.string().datetime({ offset: true }).optional()
      }).strict().parse(request.body);
      if (input.items.reduce((sum, item) => sum + item.amountCents, 0) !== input.amountCents) {
        throw safeFailure("Quotation line items must add up to the total.");
      }
      if (input.depositCents !== undefined && input.depositCents > input.amountCents) {
        throw safeFailure("Deposit cannot exceed the quotation total.");
      }
      const saved = await prisma.$transaction(async (transaction) => {
        const booking = await transaction.booking.findUnique({
          where: { id: request.params.id },
          include: { quotations: { orderBy: { version: "desc" }, take: 1 } }
        });
        if (!booking) throw safeFailure("Booking not found.", 404);
        if (!["REQUESTED", "UNDER_REVIEW", "QUOTE_SENT"].includes(booking.status)) {
          throw safeFailure("A quotation cannot be issued in the current booking status.", 409);
        }
        const quotation = await transaction.bookingQuotation.create({
          data: {
            bookingId: booking.id,
            version: (booking.quotations[0]?.version || 0) + 1,
            amountCents: input.amountCents,
            currency: input.currency.toLowerCase(),
            items: input.items,
            depositCents: input.depositCents,
            validUntil: input.validUntil ? new Date(input.validUntil) : null
          }
        });
        if (booking.status !== "QUOTE_SENT") {
          await transaction.booking.update({ where: { id: booking.id }, data: { status: "QUOTE_SENT", quoteTotalCents: input.amountCents, currency: input.currency.toLowerCase() } });
          await transaction.bookingStatusHistory.create({
            data: { bookingId: booking.id, fromStatus: booking.status, toStatus: "QUOTE_SENT", actorId: request.auth.user.id, reason: "Quotation created." }
          });
        }
        return { quotation, customerEmail: booking.customerEmail, customerName: booking.customerName, reference: booking.reference };
      });
      let emailSent = false;
      try {
        const lines = input.items.map((item) => `<li>${item.description.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c])}: ${formatNaira(item.amountCents)}</li>`).join("");
        await sendTransactionalEmail({
          to: saved.customerEmail,
          subject: `KrunchyKremmy catering quotation ${saved.reference}`,
          html: `<p>Hello,</p><p>Your catering quotation for ${saved.reference} is ready.</p><ul>${lines}</ul><p>Total: ${formatNaira(input.amountCents)}</p><p>Reply to this email to discuss or accept the quotation. This message does not confirm availability or a booking.</p>`
        });
        emailSent = true;
      } catch {
        console.error("Catering quotation email delivery failed.");
      }
      response.status(201).json({ quotation: saved.quotation, emailSent });
    } catch (error) {
      if (error.status) return response.status(error.status).json({ error: error.message });
      mapDatabaseError(error, next, response);
    }
  });

  router.get("/availability", async (_request, response, next) => {
    try {
      const availability = await prisma.bookingAvailability.findMany({ orderBy: { scope: "asc" } });
      const blackouts = await prisma.eventBlackoutDate.findMany({ where: { active: true }, orderBy: { startsAt: "asc" } });
      response.json({ availability, blackouts });
    } catch (error) {
      next(error);
    }
  });

  router.put("/availability", async (request, response, next) => {
    try {
      const input = z.object({
        timeZone: z.string().min(1).max(64),
        operatingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        availableStartTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        availableEndTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        minimumLeadHours: z.number().int().min(0).max(8760),
        maximumHorizonDays: z.number().int().min(1).max(3650),
        maximumConcurrent: z.number().int().min(1).max(100),
        setupBufferMinutes: z.number().int().min(0).max(1440),
        active: z.boolean()
      }).strict().parse(request.body);
      if (input.availableStartTime >= input.availableEndTime) throw safeFailure("Opening time must be earlier than closing time.");
      const availability = await prisma.bookingAvailability.upsert({
        where: { scope: "default" },
        update: input,
        create: { ...input, scope: "default" }
      });
      response.json({ availability });
    } catch (error) {
      if (error.status) return response.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  router.post("/blackouts", async (request, response, next) => {
    try {
      const input = z.object({
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }),
        reason: z.string().trim().max(500).optional()
      }).strict().parse(request.body);
      if (new Date(input.endsAt) <= new Date(input.startsAt)) throw safeFailure("Blackout end must be after its start.");
      const blackout = await prisma.eventBlackoutDate.create({ data: { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) } });
      response.status(201).json({ blackout });
    } catch (error) {
      if (error.status) return response.status(error.status).json({ error: error.message });
      next(error);
    }
  });

  router.delete("/blackouts/:id", async (request, response, next) => {
    try {
      const updated = await prisma.eventBlackoutDate.updateMany({ where: { id: request.params.id, active: true }, data: { active: false } });
      if (!updated.count) return response.status(404).json({ error: "Active blackout not found." });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
