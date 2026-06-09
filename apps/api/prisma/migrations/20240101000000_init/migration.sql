-- CreateTable Satellite
CREATE TABLE "Satellite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noradId" INTEGER NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "operator" TEXT,
    "country" TEXT,
    "objectType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable TLE
CREATE TABLE "TLE" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "satelliteId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT NOT NULL,
    "epoch" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TLE_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PositionSnapshot
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "satelliteId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "z" REAL NOT NULL,
    "vx" REAL NOT NULL,
    "vy" REAL NOT NULL,
    "vz" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PositionSnapshot_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable ConjunctionEvent
CREATE TABLE "ConjunctionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "satelliteAId" TEXT NOT NULL,
    "satelliteBId" TEXT NOT NULL,
    "closestApproachKm" REAL NOT NULL,
    "relativeVelocityKmS" REAL NOT NULL,
    "predictedTime" DATETIME NOT NULL,
    "riskScore" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PREDICTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConjunctionEvent_satelliteAId_fkey" FOREIGN KEY ("satelliteAId") REFERENCES "Satellite" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConjunctionEvent_satelliteBId_fkey" FOREIGN KEY ("satelliteBId") REFERENCES "Satellite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TLE_satelliteId_epoch_key" ON "TLE"("satelliteId", "epoch");

-- CreateIndex
CREATE INDEX "TLE_satelliteId_idx" ON "TLE"("satelliteId");

-- CreateIndex
CREATE INDEX "Satellite_noradId_idx" ON "Satellite"("noradId");

-- CreateIndex
CREATE INDEX "Satellite_createdAt_idx" ON "Satellite"("createdAt");

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
