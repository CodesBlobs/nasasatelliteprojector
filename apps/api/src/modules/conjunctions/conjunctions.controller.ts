import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ConjunctionsService } from './conjunctions.service'
import { DEFAULT_DETECTION_OPTIONS } from './conjunction-detector'
import { ScanDto } from './dto/scan.dto'

@ApiTags('conjunctions')
@Controller('conjunctions')
export class ConjunctionsController {
  constructor(private service: ConjunctionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conjunction events' })
  findAll() {
    return this.service.findAll()
  }

  @Get('active')
  @ApiOperation({ summary: 'List unresolved conjunction events' })
  findActive() {
    return this.service.findActive()
  }

  @Post('scan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run conjunction detection over the next 24 hours' })
  scan(@Body() body: ScanDto) {
    return this.service.runScan({
      windowHours: body.windowHours ?? DEFAULT_DETECTION_OPTIONS.windowHours,
      sampleMinutes: body.sampleMinutes ?? DEFAULT_DETECTION_OPTIONS.sampleMinutes,
      thresholdKm: body.thresholdKm ?? DEFAULT_DETECTION_OPTIONS.thresholdKm,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conjunction event by ID' })
  @ApiParam({ name: 'id', description: 'Conjunction event ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }
}
