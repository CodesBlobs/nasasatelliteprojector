import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CelestrakService } from './celestrak.service'
import { TleParserService } from '../tle/services/tle-parser.service'

export interface IngestResult {
  group: string
  total: number
  satellitesCreated: number
  tlesInserted: number
  errors: number
  durationMs: number
}

const GROUP_OBJECT_TYPES: Record<string, string> = {
  'fengyun-1c-debris': 'Debris',
  'iridium-33-debris': 'Debris',
  'cosmos-2251-debris': 'Debris',
}

function objectTypeForGroup(group: string): string {
  return GROUP_OBJECT_TYPES[group] ?? (group.includes('debris') ? 'Debris' : 'Payload')
}

// CelesTrak blocks the top-level "active" group. Fetch these instead.
const ACTIVE_SUBGROUPS = [
  'stations', 'starlink', 'oneweb', 'weather', 'amateur',
  'gps-ops', 'galileo', 'glonass-operational', 'iridium-NEXT', 'beidou',
  'last-30-days',
] as const

const CHUNK_SIZE = 500

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)

  constructor(
    private prisma: PrismaService,
    private celestrak: CelestrakService,
    private tleParser: TleParserService
  ) {}

  async ingestGroup(group: string): Promise<IngestResult> {
    const start = Date.now()

    // CelesTrak blocks the bulk "active" group — fan out to individual groups instead
    if (group === 'active') {
      const results = await Promise.allSettled(
        ACTIVE_SUBGROUPS.map((g) => this.ingestGroup(g)),
      )
      const totals = results.reduce(
        (acc, r) => {
          if (r.status === 'fulfilled') {
            acc.total += r.value.total
            acc.satellitesCreated += r.value.satellitesCreated
            acc.tlesInserted += r.value.tlesInserted
            acc.errors += r.value.errors
          } else {
            this.logger.warn(`Sub-group ingest failed: ${r.reason}`)
          }
          return acc
        },
        { total: 0, satellitesCreated: 0, tlesInserted: 0, errors: 0 },
      )
      return { group: 'active', ...totals, durationMs: Date.now() - start }
    }

    const objectType = objectTypeForGroup(group)
    const entries = await this.celestrak.fetchGroup(group)

    type ParsedEntry = {
      noradId: number
      name: string
      objectType: string
      line1: string
      line2: string
      epoch: Date
    }

    const parsed: ParsedEntry[] = []
    let errors = 0

    for (const entry of entries) {
      try {
        const data = this.tleParser.parse(entry.line1, entry.line2)
        parsed.push({
          noradId: data.noradId,
          name: entry.name.replace(/\s+/g, ' ').trim(),
          objectType,
          line1: entry.line1,
          line2: entry.line2,
          epoch: this.tleParser.epochToDate(data.epochYear, data.epochDayOfYear),
        })
      } catch {
        errors++
      }
    }

    // Bulk create new satellites, skip existing
    const countBefore = await this.prisma.satellite.count()
    await this.prisma.satellite.createMany({
      data: parsed.map((p) => ({
        noradId: p.noradId,
        name: p.name,
        objectType: p.objectType,
      })),
      skipDuplicates: true,
    })
    const satellitesCreated = (await this.prisma.satellite.count()) - countBefore

    // Fetch ID map for all affected NORAD IDs
    const noradIds = [...new Set(parsed.map((p) => p.noradId))]
    const satellites = await this.prisma.satellite.findMany({
      where: { noradId: { in: noradIds } },
      select: { id: true, noradId: true },
    })
    const idMap = new Map(satellites.map((s) => [s.noradId, s.id]))

    // Bulk create TLEs in chunks, skip if (satelliteId, epoch) already exists
    let tlesInserted = 0
    for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
      const chunk = parsed
        .slice(i, i + CHUNK_SIZE)
        .filter((p) => idMap.has(p.noradId))
        .map((p) => ({
          satelliteId: idMap.get(p.noradId)!,
          line1: p.line1,
          line2: p.line2,
          epoch: p.epoch,
        }))

      const result = await this.prisma.tLE.createMany({
        data: chunk,
        skipDuplicates: true,
      })
      tlesInserted += result.count
    }

    const durationMs = Date.now() - start
    this.logger.log(
      `Ingest complete — group: ${group}, total: ${entries.length}, ` +
        `satellitesCreated: ${satellitesCreated}, tlesInserted: ${tlesInserted}, ` +
        `errors: ${errors}, duration: ${durationMs}ms`
    )

    return { group, total: entries.length, satellitesCreated, tlesInserted, errors, durationMs }
  }
}
