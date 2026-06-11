import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SimulationStatus } from '@orbital/shared'
import type { ConjunctionImpact } from '@orbital/shared'
import { createSatrec, propagateSatrec } from '@orbital/core'
import {
  applyDeltaV,
  stateToElements,
  getAltitudesFromElements,
  generateKeplerianTrajectory,
  generateSgp4Trajectory,
  findApproachesFromPositions,
  type OrbitPoint,
  type SimulatedCandidate,
} from '../modules/simulation/maneuver-engine'
import {
  estimateFuelKg,
  deltaVMagnitudeMs,
} from '../modules/simulation/fuel-estimator'
import { parseTleOrbitalElements, computeRiskScore } from '../modules/conjunctions/conjunction-detector'
import type { SimulationJobData } from '../modules/simulation/simulation.service'
import { SIMULATION_QUEUE } from '../modules/simulation/simulation.service'
import { CONJUNCTION_CONFIG } from '../config/conjunction.config'

const SAMPLE_MINUTES = CONJUNCTION_CONFIG.sampleMinutes
const THRESHOLD_KM = CONJUNCTION_CONFIG.warningDistanceKm
const MIN_THRESHOLD_KM = CONJUNCTION_CONFIG.minimumThresholdKm
const BUFFER_KM = CONJUNCTION_CONFIG.perigeeApogeeBufferKm

@Processor(SIMULATION_QUEUE)
export class SimulationWorker extends WorkerHost {
  private readonly logger = new Logger(SimulationWorker.name)

  constructor(private prisma: PrismaService) {
    super()
  }

  async process(job: Job<SimulationJobData>): Promise<void> {
    const { simulationId } = job.data
    this.logger.log(`Starting simulation ${simulationId}`)

    await this.prisma.simulation.update({
      where: { id: simulationId },
      data: { status: SimulationStatus.RUNNING },
    })

    try {
      await this.runSimulation(simulationId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Simulation ${simulationId} failed: ${message}`)
      await this.prisma.simulation.update({
        where: { id: simulationId },
        data: { status: SimulationStatus.FAILED, errorMessage: message },
      })
    }
  }

  private async runSimulation(simulationId: string): Promise<void> {
    // ── 1. Load simulation + satellite TLE ──────────────────────────────────
    const simulation = await this.prisma.simulation.findUniqueOrThrow({
      where: { id: simulationId },
      include: {
        satellite: {
          include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
        },
      },
    })

    const tle = simulation.satellite.tle[0]
    if (!tle) {
      throw new Error(`No TLE found for satellite ${simulation.satelliteId}`)
    }

    const maneuverMs = simulation.maneuverTime.getTime()
    const windowHours = simulation.windowHours
    const deltaV = { x: simulation.deltaVx, y: simulation.deltaVy, z: simulation.deltaVz }
    const dvMagnitude = deltaVMagnitudeMs(deltaV)

    // ── 2. Get state at maneuver time via SGP4 ───────────────────────────────
    const satrec = createSatrec(tle.line1, tle.line2)
    const stateAtManeuver = propagateSatrec(satrec, new Date(maneuverMs))
    const originalState = {
      position: stateAtManeuver.position,
      velocity: stateAtManeuver.velocity,
    }

    // ── 3. Apply delta-V ─────────────────────────────────────────────────────
    const modifiedState = applyDeltaV(originalState, deltaV)

    // ── 4. Generate trajectories ─────────────────────────────────────────────
    const [originalTrajectory, simulatedTrajectory] = await Promise.all([
      Promise.resolve(
        generateSgp4Trajectory(tle.line1, tle.line2, maneuverMs, windowHours, SAMPLE_MINUTES),
      ),
      Promise.resolve(
        generateKeplerianTrajectory(modifiedState, maneuverMs, windowHours, SAMPLE_MINUTES),
      ),
    ])

    // ── 5. Orbital elements of simulated orbit ───────────────────────────────
    const simElements = stateToElements(modifiedState, maneuverMs)
    const { perigeeKm: simPerigeeKm, apogeeKm: simApogeeKm } = getAltitudesFromElements(simElements)

    // Original orbit altitudes from TLE
    const { perigeeKm: origPerigeeKm, apogeeKm: origApogeeKm } = parseTleOrbitalElements(
      tle.line1,
      tle.line2,
    )

    // ── 6. Load all other satellites for conjunction analysis ────────────────
    const PAGE = 5000
    let skip = 0
    const candidates: SimulatedCandidate[] = []

    for (;;) {
      const rows = await this.prisma.satellite.findMany({
        skip,
        take: PAGE,
        where: { id: { not: simulation.satelliteId } },
        include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { line1: true, line2: true } } },
      })
      for (const sat of rows) {
        const satTle = sat.tle[0]
        if (!satTle) continue
        try {
          const { perigeeKm, apogeeKm } = parseTleOrbitalElements(satTle.line1, satTle.line2)
          candidates.push({
            satelliteId: sat.id,
            noradId: sat.noradId,
            name: sat.name,
            line1: satTle.line1,
            line2: satTle.line2,
            perigeeKm,
            apogeeKm,
          })
        } catch {
          // invalid TLE
        }
      }
      skip += PAGE
      if (rows.length < PAGE) break
    }

    // ── 7. Conjunction scan: original orbit ──────────────────────────────────
    const originalApproaches = findApproachesFromPositions(
      originalTrajectory,
      simulation.satelliteId,
      origPerigeeKm,
      origApogeeKm,
      candidates,
      THRESHOLD_KM,
      MIN_THRESHOLD_KM,
      BUFFER_KM,
    )

    // ── 8. Conjunction scan: simulated orbit ─────────────────────────────────
    const simulatedApproaches = findApproachesFromPositions(
      simulatedTrajectory,
      simulation.satelliteId,
      simPerigeeKm,
      simApogeeKm,
      candidates,
      THRESHOLD_KM,
      MIN_THRESHOLD_KM,
      BUFFER_KM,
    )

    // ── 9. Build conjunction impact report ───────────────────────────────────
    const origBySat = new Map(originalApproaches.map((a) => [a.satelliteBId, a]))
    const simBySat = new Map(simulatedApproaches.map((a) => [a.satelliteBId, a]))

    // All satellite IDs appearing in either scan
    const allSatIds = new Set([...origBySat.keys(), ...simBySat.keys()])
    const satMeta = new Map(candidates.map((c) => [c.satelliteId, c]))

    const conjunctionImpacts: ConjunctionImpact[] = []
    for (const satId of allSatIds) {
      const meta = satMeta.get(satId)
      if (!meta) continue
      const orig = origBySat.get(satId)
      const sim = simBySat.get(satId)

      const beforeApproachKm = orig?.closestApproachKm ?? null
      const afterApproachKm = sim?.closestApproachKm ?? null
      const beforeRiskScore = orig ? computeRiskScore(orig.closestApproachKm, THRESHOLD_KM) : 0
      const afterRiskScore = sim ? computeRiskScore(sim.closestApproachKm, THRESHOLD_KM) : 0

      let status: ConjunctionImpact['status']
      if (orig && !sim) status = 'REMOVED'
      else if (!orig && sim) status = 'CREATED'
      else if (orig && sim) {
        const improvement = orig.closestApproachKm - sim.closestApproachKm
        if (improvement > 0.5) status = 'REDUCED'
        else if (improvement < -0.5) status = 'WORSENED'
        else status = 'UNCHANGED'
      } else {
        continue
      }

      conjunctionImpacts.push({
        satelliteId: satId,
        satelliteName: meta.name,
        noradId: meta.noradId,
        beforeApproachKm,
        afterApproachKm,
        beforeRiskScore,
        afterRiskScore,
        status,
      })
    }

    // ── 10. Aggregate metrics ─────────────────────────────────────────────────
    const closestBefore = originalApproaches[0]?.closestApproachKm ?? THRESHOLD_KM
    const closestAfter = simulatedApproaches[0]?.closestApproachKm ?? THRESHOLD_KM
    const oldRiskScore = originalApproaches.length > 0
      ? computeRiskScore(closestBefore, THRESHOLD_KM)
      : 0
    const newRiskScore = simulatedApproaches.length > 0
      ? computeRiskScore(closestAfter, THRESHOLD_KM)
      : 0

    const riskReductionPercent =
      oldRiskScore > 0
        ? Math.round(((oldRiskScore - newRiskScore) / oldRiskScore) * 1000) / 10
        : 0

    const fuelEstimateKg = estimateFuelKg(dvMagnitude)

    const conjunctionsRemoved = conjunctionImpacts.filter((c) => c.status === 'REMOVED').length
    const conjunctionsCreated = conjunctionImpacts.filter((c) => c.status === 'CREATED').length

    // ── 11. Persist result ────────────────────────────────────────────────────
    await this.prisma.$transaction([
      this.prisma.simulationResult.create({
        data: {
          simulationId,
          oldRiskScore,
          newRiskScore,
          fuelEstimateKg,
          deltaVMagnitudeMs: dvMagnitude,
          conjunctionsRemoved,
          conjunctionsCreated,
          closestApproachBefore: closestBefore,
          closestApproachAfter: closestAfter,
          riskReductionPercent,
          originalTrajectory: originalTrajectory as unknown as object,
          simulatedTrajectory: simulatedTrajectory as unknown as object,
          conjunctionImpacts: conjunctionImpacts as unknown as object,
        },
      }),
      this.prisma.simulation.update({
        where: { id: simulationId },
        data: { status: SimulationStatus.COMPLETED },
      }),
    ])

    this.logger.log(
      `Simulation ${simulationId} completed: risk ${oldRiskScore.toFixed(1)} → ${newRiskScore.toFixed(1)}, ` +
        `${conjunctionsRemoved} removed, ${conjunctionsCreated} created, ` +
        `fuel ≈ ${fuelEstimateKg.toFixed(2)} kg`,
    )
  }
}
