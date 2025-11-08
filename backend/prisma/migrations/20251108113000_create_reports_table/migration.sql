-- Create reports table matching Prisma schema
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for status and reported_id for faster admin filtering
CREATE INDEX "reports_reported_id_idx" ON "reports"("reported_id");
CREATE INDEX "reports_status_idx" ON "reports"("status");