ALTER TABLE "Order" RENAME COLUMN "paymentIntentId" TO "providerTransactionId";
ALTER TABLE "Order" RENAME COLUMN "checkoutSessionId" TO "providerSessionId";

ALTER INDEX "Order_paymentIntentId_key" RENAME TO "Order_providerTransactionId_key";
ALTER INDEX "Order_checkoutSessionId_key" RENAME TO "Order_providerSessionId_key";
