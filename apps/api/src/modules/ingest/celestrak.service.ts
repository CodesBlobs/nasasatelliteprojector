import { Injectable, Logger } from '@nestjs/common'

export interface TleEntry {
  name: string
  line1: string
  line2: string
}

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php'

@Injectable()
export class CelestrakService {
  private readonly logger = new Logger(CelestrakService.name)

  async fetchGroup(group: string): Promise<TleEntry[]> {
    const url = `${CELESTRAK_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=TLE`
    this.logger.log(`Fetching CelesTrak group: ${group}`)

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Orbital/1.0 (space-traffic-control)' },
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(
        `CelesTrak request failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    const entries = this.parse3LE(text)
    this.logger.log(`Parsed ${entries.length} entries from group: ${group}`)
    return entries
  }

  private parse3LE(raw: string): TleEntry[] {
    const lines = raw
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)

    const entries: TleEntry[] = []

    for (let i = 0; i + 2 < lines.length; i += 3) {
      const name = lines[i].trim()
      const line1 = lines[i + 1].trim()
      const line2 = lines[i + 2].trim()

      if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
        entries.push({ name, line1, line2 })
      }
    }

    return entries
  }
}
