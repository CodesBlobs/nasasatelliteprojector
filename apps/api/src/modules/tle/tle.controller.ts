import { Controller, Post, Get, Body, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { TleService, ImportTleResult } from './tle.service'
import { ImportTleDto } from './dto/import-tle.dto'

@ApiTags('tle')
@Controller('tle')
export class TleController {
  constructor(private service: TleService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Import a TLE',
    description:
      'Import a Two-Line Element. Creates satellite record if new, updates TLE if exists.',
  })
  @ApiResponse({
    status: 201,
    description: 'TLE imported successfully',
    schema: {
      example: {
        id: 'abc123',
        name: 'ISS (ZARYA)',
        noradId: 25544,
        epoch: '2023-01-15T12:00:00Z',
        created: true,
      },
    },
  })
  async import(@Body() dto: ImportTleDto): Promise<ImportTleResult> {
    return this.service.import(dto)
  }

  @Get()
  @ApiOperation({
    summary: 'List latest TLEs',
    description: 'Get the latest TLE for each satellite',
  })
  async listLatest(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) {
    return this.service.listLatestTles(limit)
  }

  @Get(':noradId')
  @ApiOperation({
    summary: 'Get TLE by NORAD ID',
    description: 'Get satellite and its latest TLE',
  })
  async getByNoradId(
    @Param('noradId', ParseIntPipe) noradId: number
  ) {
    return this.service.getLatestByNoradId(noradId)
  }

  @Get(':noradId/history')
  @ApiOperation({
    summary: 'Get TLE history',
    description: 'Get satellite and its TLE history',
  })
  async getHistory(
    @Param('noradId', ParseIntPipe) noradId: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    return this.service.getTleHistory(noradId, limit)
  }
}
