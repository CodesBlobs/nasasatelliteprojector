import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { propagateSatellite } from '@orbital/core'

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name)

  constructor(private prisma: PrismaService) {}

  async generatePositionSnapshot(at?: Date): Promise<{ written: number; errors: number }> {
    const satellites = await this.prisma.satellite.findMany({
      include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
    })

    const now = at ?? new Date()
    let written = 0
    let errors = 0

    for (const satellite of satellites) {
      const tle = satellite.tle[0]
      if (!tle) continue

      try {
        const result = propagateSatellite(tle.line1, tle.line2, now)

        await this.prisma.positionSnapshot.create({
          data: {
            satelliteId: satellite.id,
            timestamp: now,
            x: result.position.x,
            y: result.position.y,
            z: result.position.z,
            vx: result.velocity.x,
            vy: result.velocity.y,
            vz: result.velocity.z,
          },
        })

        written++
      } catch (err) {
        errors++
        this.logger.warn(
          `Failed to snapshot NORAD ${satellite.noradId}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    this.logger.log(`Snapshot complete: ${written} written, ${errors} errors`)
    return { written, errors }
  }
}
