import { Controller, Get, Param, Patch } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AlertsService } from './alerts.service'

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List all alerts' })
  findAll() {
    return this.service.findAll()
  }

  @Get('open')
  @ApiOperation({ summary: 'List open alerts' })
  findOpen() {
    return this.service.findOpen()
  }

  @Get('critical')
  @ApiOperation({ summary: 'List critical-severity alerts' })
  findCritical() {
    return this.service.findCritical()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'id' })
  acknowledge(@Param('id') id: string) {
    return this.service.acknowledge(id)
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({ name: 'id' })
  resolve(@Param('id') id: string) {
    return this.service.resolve(id)
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss an alert' })
  @ApiParam({ name: 'id' })
  dismiss(@Param('id') id: string) {
    return this.service.dismiss(id)
  }
}
