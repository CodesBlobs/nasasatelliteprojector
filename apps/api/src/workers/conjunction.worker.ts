import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import type { Job } from 'bullmq'
import { ConjunctionsService } from '../modules/conjunctions/conjunctions.service'
import { MetricsService } from '../modules/system/metrics.service'
import { EventsService } from '../modules/events/events.service'
import { CONJUNCTION_CONFIG } from '../config/conjunction.config'

export const CONJUNCTION_QUEUE = 'conjunction-scan'
export const ALERT_QUEUE = 'alert-generation'

export interface ScanJobData {
  type: 'full-scan'
}

@Processor(CONJUNCTION_QUEUE)
export class ConjunctionWorker extends WorkerHost {
  private readonly logger = new Logger(ConjunctionWorker.name)

  constructor(
    private conjunctions: ConjunctionsService,
    private metrics: MetricsService,
    private events: EventsService,
    @InjectQueue(ALERT_QUEUE) private alertQueue: Queue,
  ) {
    super()
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    this.logger.log(`Starting conjunction scan job ${job.id}`)

    const summary = await this.conjunctions.runScan({
      windowHours: CONJUNCTION_CONFIG.predictionWindowHours,
      sampleMinutes: CONJUNCTION_CONFIG.sampleMinutes,
      thresholdKm: CONJUNCTION_CONFIG.warningDistanceKm,
      minimumThresholdKm: CONJUNCTION_CONFIG.minimumThresholdKm,
      perigeeApogeeBufferKm: CONJUNCTION_CONFIG.perigeeApogeeBufferKm,
    })

    this.metrics.recordScan({
      lastScanAt: new Date().toISOString(),
      lastScanDurationMs: summary.durationMs,
      lastScanSatellites: summary.scannedSatellites,
      lastScanCandidatePairs: summary.metrics.candidatePairs,
      lastScanReductionPercent: summary.metrics.reductionPercent,
      lastScanConjunctionsFound: summary.eventsCreated,
    })

    // Fetch the newly created conjunction IDs and dispatch alert generation
    const newConjunctions = await this.conjunctions.findActive()
    if (newConjunctions.length > 0) {
      await this.alertQueue.add('generate', {
        conjunctionIds: newConjunctions.map((c) => c.id),
      })
    }

    // Notify connected SSE clients
    this.events.emit('conjunction:scan-complete', {
      eventsFound: summary.eventsCreated,
      scannedAt: new Date().toISOString(),
      metrics: summary.metrics,
    })

    this.logger.log(
      `Scan complete: ${summary.metrics.reductionPercent}% pair reduction, ` +
        `${summary.eventsCreated} conjunctions in ${summary.durationMs}ms`,
    )
  }
}
