import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { CONJUNCTION_QUEUE } from '../../workers/conjunction.worker'
import { CONJUNCTION_CONFIG } from '../../config/conjunction.config'

@Injectable()
export class ConjunctionScheduler {
  private readonly logger = new Logger(ConjunctionScheduler.name)

  constructor(
    @Optional() @InjectQueue(CONJUNCTION_QUEUE) private queue: Queue | null,
  ) {}

  // Runs every 15 minutes. Adjust via CONJUNCTION_CONFIG.scanIntervalMinutes.
  // Using a fixed cron expression; the config value is documentation.
  @Cron(`*/${CONJUNCTION_CONFIG.scanIntervalMinutes} * * * *`)
  async scheduleScan(): Promise<void> {
    if (!this.queue) {
      this.logger.warn('Redis queue not available — skipping scheduled scan')
      return
    }
    try {
      const [active, waiting] = await Promise.all([
        this.queue.getActiveCount(),
        this.queue.getWaitingCount(),
      ])
      if (active > 0 || waiting > 0) {
        this.logger.log(`Scan already in progress (active: ${active}, waiting: ${waiting}) — skipping`)
        return
      }
      await this.queue.add('scan', { type: 'full-scan' }, { removeOnComplete: 50, removeOnFail: 20 })
      this.logger.log('Conjunction scan job enqueued')
    } catch (err) {
      this.logger.error('Failed to enqueue conjunction scan', err)
    }
  }
}
