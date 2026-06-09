import { BadRequestException, Controller, Logger, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { IngestService } from './ingest.service'

const ALLOWED_GROUPS = new Set([
  'stations',
  'active',
  'visual',
  'last-30-days',
  'starlink',
  'oneweb',
  'gnss',
  'weather',
  'military',
  'cubesat',
  'fengyun-1c-debris',
  'iridium-33-debris',
  'cosmos-2251-debris',
])

@ApiTags('ingest')
@Controller('ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name)

  constructor(private service: IngestService) {}

  @Post('celestrak')
  @ApiOperation({ summary: 'Ingest a satellite group from CelesTrak' })
  @ApiQuery({
    name: 'group',
    required: false,
    description: 'CelesTrak group name',
    example: 'stations',
  })
  async ingest(@Query('group') group = 'stations') {
    if (!ALLOWED_GROUPS.has(group)) {
      throw new BadRequestException(
        `Unknown group "${group}". Allowed: ${[...ALLOWED_GROUPS].join(', ')}`
      )
    }
    this.logger.log(`Ingest requested for group: ${group}`)
    return this.service.ingestGroup(group)
  }
}
