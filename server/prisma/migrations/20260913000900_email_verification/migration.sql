CREATE TABLE "email_verifications" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "display_name" VARCHAR(40) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "otp_hash" VARCHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_sent_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verifications_email_key" ON "email_verifications"("email");
CREATE INDEX "email_verifications_expires_at_idx" ON "email_verifications"("expires_at");
