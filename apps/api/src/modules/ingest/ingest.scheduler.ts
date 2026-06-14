import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma/prisma.service'
import { IngestService } from './ingest.service'

@Injectable()
export class IngestScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestScheduler.name)
  private running = false

  constructor(
    private prisma: PrismaService,
    private ingest: IngestService,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.prisma.satellite.count()
    if (count < 100) {
      this.logger.log(`Database has ${count} satellites — starting initial TLE import`)
      void this.runIngest('startup')
    } else {
      this.logger.log(`Database has ${count} satellites — skipping startup import`)
    }
  }

  // Refresh TLE data every day at 02:00 UTC (CelesTrak updates daily)
  @Cron('0 2 * * *')
  async scheduledRefresh() {
    this.logger.log('Daily TLE refresh triggered')
    void this.runIngest('scheduled')
  }

  private async runIngest(trigger: string) {
    if (this.running) {
      this.logger.warn(`Ingest already in progress — skipping ${trigger} trigger`)
      return
    }
    this.running = true
    try {
      const result = await this.ingest.ingestGroup('active')
      this.logger.log(
        `[${trigger}] Ingest complete — ${result.total} objects, ` +
          `${result.satellitesCreated} new satellites, ${result.tlesInserted} TLEs, ` +
          `${result.errors} errors, ${(result.durationMs / 1000).toFixed(1)}s`,
      )
    } catch (err) {
      this.logger.error(`[${trigger}] Ingest failed`, err)
    } finally {
      this.running = false
    }
  }
}
