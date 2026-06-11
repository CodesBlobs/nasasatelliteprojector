import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AlertStatus } from '@orbital/shared'
import { MetricsService } from './metrics.service'

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(
    private prisma: PrismaService,
    private metrics: MetricsService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'System health and scan metrics' })
  async getMetrics() {
    const [
      totalSatellites,
      satellitesWithTle,
      totalConjunctions,
      activeConjunctions,
      criticalConjunctions,
      openAlerts,
      criticalAlerts,
      acknowledgedAlerts,
    ] = await Promise.all([
      this.prisma.satellite.count(),
      this.prisma.satellite.count({ where: { tle: { some: {} } } }),
      this.prisma.conjunctionEvent.count(),
      this.prisma.conjunctionEvent.count({ where: { status: { not: 'RESOLVED' } } }),
      this.prisma.conjunctionEvent.count({ where: { riskLevel: 'CRITICAL' } }),
      this.prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
      this.prisma.alert.count({ where: { severity: 'CRITICAL' } }),
      this.prisma.alert.count({ where: { status: AlertStatus.ACKNOWLEDGED } }),
    ])

    return {
      satellites: { total: totalSatellites, withTle: satellitesWithTle },
      conjunctions: { total: totalConjunctions, active: activeConjunctions, critical: criticalConjunctions },
      alerts: { open: openAlerts, critical: criticalAlerts, acknowledged: acknowledgedAlerts },
      workers: this.metrics.worker,
    }
  }
}
