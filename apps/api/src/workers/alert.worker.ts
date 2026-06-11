import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { AlertsService } from '../modules/alerts/alerts.service'
import { ConjunctionsService } from '../modules/conjunctions/conjunctions.service'
import { MetricsService } from '../modules/system/metrics.service'
import { EventsService } from '../modules/events/events.service'
import { ALERT_QUEUE } from './conjunction.worker'

export interface AlertJobData {
  conjunctionIds: string[]
}

@Processor(ALERT_QUEUE)
export class AlertWorker extends WorkerHost {
  private readonly logger = new Logger(AlertWorker.name)

  constructor(
    private alertsService: AlertsService,
    private conjunctionsService: ConjunctionsService,
    private metrics: MetricsService,
    private events: EventsService,
  ) {
    super()
  }

  async process(job: Job<AlertJobData>): Promise<void> {
    const { conjunctionIds } = job.data
    if (!conjunctionIds?.length) return

    // Fetch all conjunction records in a single query
    const valid = await this.conjunctionsService.findManyByIds(conjunctionIds)

    const count = await this.alertsService.generateForConjunctions(
      valid.map((c) => ({
        id: c.id,
        closestApproachKm: c.closestApproachKm,
        relativeVelocityKmS: c.relativeVelocityKmS,
        predictedTime: c.predictedTime,
        satelliteA: { noradId: c.satelliteA.noradId, name: c.satelliteA.name },
        satelliteB: { noradId: c.satelliteB.noradId, name: c.satelliteB.name },
      })),
    )

    this.metrics.recordAlertGeneration(count)

    if (count > 0) {
      // Fetch new open alerts and push them to SSE subscribers
      const openAlerts = await this.alertsService.findOpen()
      this.events.emit('alert:created', { count, alerts: openAlerts.slice(0, 20) })
      this.logger.log(`Generated ${count} new alerts`)
    }
  }
}
