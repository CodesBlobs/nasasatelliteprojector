-- Drop redundant noradId index (covered by the @unique constraint)
DROP INDEX IF EXISTS "Satellite_noradId_idx";

-- Replace predictedTime-only index with composite status+predictedTime on ConjunctionEvent
-- (speeds up findActive which filters by status != RESOLVED)
DROP INDEX IF EXISTS "ConjunctionEvent_predictedTime_idx";
CREATE INDEX "ConjunctionEvent_status_predictedTime_idx" ON "ConjunctionEvent"("status", "predictedTime");

-- Replace four single-column Alert indexes with two composites
DROP INDEX IF EXISTS "Alert_status_idx";
DROP INDEX IF EXISTS "Alert_createdAt_idx";
CREATE INDEX "Alert_status_createdAt_idx" ON "Alert"("status", "createdAt" DESC);
