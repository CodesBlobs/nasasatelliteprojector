import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ConjunctionsService } from './conjunctions.service'
import { DEFAULT_DETECTION_OPTIONS } from './conjunction-detector'
import { ScanDto } from './dto/scan.dto'

@ApiTags('conjunctions')
@Controller('conjunctions')
export class ConjunctionsController {
  constructor(private service: ConjunctionsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get conjunction counts by status/risk (lightweight)' })
  getStats() {
    return this.service.getStats()
  }

  @Get()
  @ApiOperation({ summary: 'List all conjunction events' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.findAll(skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 100)
  }

  @Get('active')
  @ApiOperation({ summary: 'List unresolved conjunction events (highest risk first)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  findActive(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.findActive(skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 100)
  }

  @Post('scan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run conjunction detection over the next 24 hours' })
  scan(@Body() body: ScanDto) {
    return this.service.runScan({
      windowHours: body.windowHours ?? DEFAULT_DETECTION_OPTIONS.windowHours,
      sampleMinutes: body.sampleMinutes ?? DEFAULT_DETECTION_OPTIONS.sampleMinutes,
      thresholdKm: body.thresholdKm ?? DEFAULT_DETECTION_OPTIONS.thresholdKm,
      minimumThresholdKm: body.minimumThresholdKm ?? DEFAULT_DETECTION_OPTIONS.minimumThresholdKm,
      perigeeApogeeBufferKm: DEFAULT_DETECTION_OPTIONS.perigeeApogeeBufferKm,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conjunction event by ID' })
  @ApiParam({ name: 'id', description: 'Conjunction event ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }
}
