ALTER TABLE "Product"
ADD COLUMN "customizationOptions" JSONB;

ALTER TABLE "Booking"
ADD COLUMN "budgetRange" TEXT;
