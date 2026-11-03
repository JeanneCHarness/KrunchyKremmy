ALTER TABLE "Order"
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paymentAuthorizationUrl" TEXT;

CREATE UNIQUE INDEX "Order_paymentReference_key" ON "Order"("paymentReference");
