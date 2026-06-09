-- Add index on epoch for better query performance
CREATE INDEX "TLE_epoch_idx" ON "TLE"("epoch");

-- Add explicit constraint name for upsert operations (Prisma compatibility)
-- Note: PostgreSQL automatically creates this constraint from the unique index
