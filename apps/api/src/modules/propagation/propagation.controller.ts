import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger'
import { PropagationService } from './propagation.service'
import { PropagateQueryDto } from './dto/propagate.dto'

@ApiTags('propagation')
@Controller('satellites')
export class PropagationController {
  constructor(private service: PropagationService) {}

  @Get('positions')
  @ApiOperation({ summary: 'Get positions for multiple satellites (batch)' })
  @ApiQuery({ name: 'noradIds', description: 'Comma-separated NORAD catalog numbers' })
  @ApiQuery({ name: 'time', required: false, description: 'ISO 8601 UTC timestamp (default: now)' })
  async getPositions(
    @Query('noradIds') noradIdsStr: string,
    @Query('time') time?: string,
  ) {
    const noradIds = (noradIdsStr ?? '')
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((n) => !isNaN(n))
    const timestamp = time ? new Date(time) : undefined
    return this.service.getPositions(noradIds, timestamp)
  }

  @Get(':noradId/position')
  @ApiOperation({ summary: 'Get position and velocity for a satellite at a given time (default: now)' })
  @ApiParam({ name: 'noradId', type: Number, description: 'NORAD catalog number' })
  @ApiQuery({ name: 'time', required: false, description: 'ISO 8601 UTC timestamp' })
  async getPosition(
    @Param('noradId', ParseIntPipe) noradId: number,
    @Query() query: PropagateQueryDto
  ) {
    const timestamp = query.time ? new Date(query.time) : undefined
    return this.service.getPosition(noradId, timestamp)
  }

  @Get(':noradId/orbit')
  @ApiOperation({ summary: 'Get 100 orbital track points over the next 90 minutes' })
  @ApiParam({ name: 'noradId', type: Number, description: 'NORAD catalog number' })
  async getOrbit(@Param('noradId', ParseIntPipe) noradId: number) {
    return this.service.getOrbit(noradId)
  }
}
