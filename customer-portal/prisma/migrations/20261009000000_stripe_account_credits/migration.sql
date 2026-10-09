ALTER TABLE "billing_adjustments"
ADD COLUMN "stripe_reference" TEXT;

CREATE UNIQUE INDEX "billing_adjustments_stripe_reference_key"
ON "billing_adjustments"("stripe_reference");
