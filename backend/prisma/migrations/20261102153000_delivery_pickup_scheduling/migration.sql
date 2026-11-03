ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_PICKUP';
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE 'COLLECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_REVIEW';

CREATE TYPE "FulfillmentMethod" AS ENUM ('DELIVERY', 'PICKUP');

CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "neighborhoods" TEXT[] NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "estimatedDurationMinutes" INTEGER NOT NULL,
    "minimumLeadMinutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "directions" TEXT,
    "instructions" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentSchedule" (
    "id" TEXT NOT NULL,
    "method" "FulfillmentMethod" NOT NULL,
    "timeZone" TEXT NOT NULL,
    "operatingDays" JSONB NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL,
    "maximumOrdersPerSlot" INTEGER NOT NULL,
    "cutoffMinutes" INTEGER NOT NULL DEFAULT 0,
    "minimumLeadMinutes" INTEGER NOT NULL,
    "maximumHorizonDays" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FulfillmentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentBlackoutDate" (
    "id" TEXT NOT NULL,
    "method" "FulfillmentMethod",
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FulfillmentBlackoutDate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentSlot" (
    "id" TEXT NOT NULL,
    "method" "FulfillmentMethod" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FulfillmentSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "reference" TEXT NOT NULL,
    "authorizationUrl" TEXT,
    "providerTransactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ngn',
    "verifiedAt" TIMESTAMP(3),
    "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
    ADD COLUMN "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "totalCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "fulfillmentMethod" "FulfillmentMethod",
    ADD COLUMN "fulfillmentTimeZone" TEXT,
    ADD COLUMN "deliveryZoneId" TEXT,
    ADD COLUMN "deliveryZoneName" TEXT,
    ADD COLUMN "deliveryNeighborhood" TEXT,
    ADD COLUMN "recipientName" TEXT,
    ADD COLUMN "recipientPhone" TEXT,
    ADD COLUMN "deliveryAddress" TEXT,
    ADD COLUMN "deliveryBuilding" TEXT,
    ADD COLUMN "deliveryLandmark" TEXT,
    ADD COLUMN "deliveryInstructions" TEXT,
    ADD COLUMN "pickupLocationName" TEXT,
    ADD COLUMN "pickupLocationAddress" TEXT,
    ADD COLUMN "pickupLocationPhone" TEXT,
    ADD COLUMN "pickupInstructions" TEXT,
    ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
    ADD COLUMN "scheduledEndAt" TIMESTAMP(3),
    ADD COLUMN "scheduleSlotId" TEXT,
    ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
    ADD COLUMN "reservationActive" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "checkoutRequestHash" TEXT,
    ADD COLUMN "assignedRiderName" TEXT,
    ADD COLUMN "riderContact" TEXT,
    ADD COLUMN "dispatchNotes" TEXT,
    ADD COLUMN "trackingReference" TEXT,
    ADD COLUMN "dispatchedAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "customerNotes" TEXT;

UPDATE "Order" SET "totalCents" = "subtotalCents";

CREATE UNIQUE INDEX "DeliveryZone_slug_key" ON "DeliveryZone"("slug");
CREATE INDEX "DeliveryZone_active_name_idx" ON "DeliveryZone"("active", "name");
CREATE UNIQUE INDEX "FulfillmentSchedule_method_key" ON "FulfillmentSchedule"("method");
CREATE INDEX "FulfillmentBlackoutDate_method_startsAt_endsAt_idx" ON "FulfillmentBlackoutDate"("method", "startsAt", "endsAt");
CREATE UNIQUE INDEX "FulfillmentSlot_method_startsAt_key" ON "FulfillmentSlot"("method", "startsAt");
CREATE INDEX "FulfillmentSlot_startsAt_method_idx" ON "FulfillmentSlot"("startsAt", "method");
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");
CREATE UNIQUE INDEX "PaymentAttempt_providerTransactionId_key" ON "PaymentAttempt"("providerTransactionId");
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");
CREATE UNIQUE INDEX "OrderNotification_orderId_type_key" ON "OrderNotification"("orderId", "type");
CREATE INDEX "OrderNotification_status_updatedAt_idx" ON "OrderNotification"("status", "updatedAt");
CREATE INDEX "Order_fulfillmentMethod_scheduledStartAt_idx" ON "Order"("fulfillmentMethod", "scheduledStartAt");
CREATE INDEX "Order_deliveryZoneId_idx" ON "Order"("deliveryZoneId");
CREATE INDEX "Order_scheduleSlotId_idx" ON "Order"("scheduleSlotId");
CREATE INDEX "Order_reservationActive_reservationExpiresAt_idx" ON "Order"("reservationActive", "reservationExpiresAt");

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_deliveryZoneId_fkey"
    FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Order_scheduleSlotId_fkey"
    FOREIGN KEY ("scheduleSlotId") REFERENCES "FulfillmentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
    ADD CONSTRAINT "PaymentAttempt_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderNotification"
    ADD CONSTRAINT "OrderNotification_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
