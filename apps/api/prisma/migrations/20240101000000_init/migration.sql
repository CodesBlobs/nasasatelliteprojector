-- CreateTable
CREATE TABLE "Satellite" (
    "id" TEXT NOT NULL,
    "noradId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "operator" TEXT,
    "country" TEXT,
    "objectType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Satellite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TLE" (
    "id" TEXT NOT NULL,
    "satelliteId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT NOT NULL,
    "epoch" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TLE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL,
    "satelliteId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "vx" DOUBLE PRECISION NOT NULL,
    "vy" DOUBLE PRECISION NOT NULL,
    "vz" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConjunctionEvent" (
    "id" TEXT NOT NULL,
    "satelliteAId" TEXT NOT NULL,
    "satelliteBId" TEXT NOT NULL,
    "closestApproachKm" DOUBLE PRECISION NOT NULL,
    "relativeVelocityKmS" DOUBLE PRECISION NOT NULL,
    "predictedTime" TIMESTAMP(3) NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PREDICTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConjunctionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Satellite_noradId_key" ON "Satellite"("noradId");

-- CreateIndex
CREATE INDEX "Satellite_noradId_idx" ON "Satellite"("noradId");

-- CreateIndex
CREATE INDEX "Satellite_createdAt_idx" ON "Satellite"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TLE_satelliteId_epoch_key" ON "TLE"("satelliteId", "epoch");

-- CreateIndex
CREATE INDEX "TLE_satelliteId_idx" ON "TLE"("satelliteId");

-- CreateIndex
CREATE INDEX "PositionSnapshot_satelliteId_timestamp_idx" ON "PositionSnapshot"("satelliteId", "timestamp");

-- CreateIndex
CREATE INDEX "PositionSnapshot_timestamp_idx" ON "PositionSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "ConjunctionEvent_satelliteAId_satelliteBId_idx" ON "ConjunctionEvent"("satelliteAId", "satelliteBId");

-- CreateIndex
CREATE INDEX "ConjunctionEvent_predictedTime_idx" ON "ConjunctionEvent"("predictedTime");

-- CreateIndex
CREATE INDEX "ConjunctionEvent_riskLevel_idx" ON "ConjunctionEvent"("riskLevel");

-- AddForeignKey
ALTER TABLE "TLE" ADD CONSTRAINT "TLE_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConjunctionEvent" ADD CONSTRAINT "ConjunctionEvent_satelliteAId_fkey" FOREIGN KEY ("satelliteAId") REFERENCES "Satellite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConjunctionEvent" ADD CONSTRAINT "ConjunctionEvent_satelliteBId_fkey" FOREIGN KEY ("satelliteBId") REFERENCES "Satellite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
