import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { SimulationService } from './simulation.service'
import { CreateSimulationDto } from './dto/create-simulation.dto'

@ApiTags('simulation')
@Controller('simulation')
export class SimulationController {
  constructor(private service: SimulationService) {}

  @Post('maneuver')
  @ApiOperation({ summary: 'Create and queue a maneuver simulation' })
  create(@Body() dto: CreateSimulationDto) {
    return this.service.create(dto)
  }

  @Get('satellite/:satelliteId')
  @ApiOperation({ summary: 'List recent simulations for a satellite' })
  @ApiParam({ name: 'satelliteId', description: 'Satellite database ID' })
  bySatellite(@Param('satelliteId') satelliteId: string) {
    return this.service.findBySatellite(satelliteId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get simulation status' })
  @ApiParam({ name: 'id', description: 'Simulation ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get simulation with full results' })
  @ApiParam({ name: 'id', description: 'Simulation ID' })
  results(@Param('id') id: string) {
    return this.service.findWithResult(id)
  }
}
