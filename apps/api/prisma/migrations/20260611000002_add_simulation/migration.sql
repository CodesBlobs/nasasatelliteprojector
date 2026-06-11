-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "satelliteId" TEXT NOT NULL,
    "deltaVx" DOUBLE PRECISION NOT NULL,
    "deltaVy" DOUBLE PRECISION NOT NULL,
    "deltaVz" DOUBLE PRECISION NOT NULL,
    "maneuverTime" TIMESTAMP(3) NOT NULL,
    "windowHours" INTEGER NOT NULL DEFAULT 24,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResult" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "oldRiskScore" DOUBLE PRECISION NOT NULL,
    "newRiskScore" DOUBLE PRECISION NOT NULL,
    "fuelEstimateKg" DOUBLE PRECISION NOT NULL,
    "deltaVMagnitudeMs" DOUBLE PRECISION NOT NULL,
    "conjunctionsRemoved" INTEGER NOT NULL,
    "conjunctionsCreated" INTEGER NOT NULL,
    "closestApproachBefore" DOUBLE PRECISION NOT NULL,
    "closestApproachAfter" DOUBLE PRECISION NOT NULL,
    "riskReductionPercent" DOUBLE PRECISION NOT NULL,
    "originalTrajectory" JSONB NOT NULL,
    "simulatedTrajectory" JSONB NOT NULL,
    "conjunctionImpacts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Simulation_satelliteId_idx" ON "Simulation"("satelliteId");

-- CreateIndex
CREATE INDEX "Simulation_status_createdAt_idx" ON "Simulation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationResult_simulationId_key" ON "SimulationResult"("simulationId");

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResult" ADD CONSTRAINT "SimulationResult_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
