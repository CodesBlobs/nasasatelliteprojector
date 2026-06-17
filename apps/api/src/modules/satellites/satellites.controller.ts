import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { SatellitesService } from './satellites.service'
import { CreateSatelliteDto } from './dto/create-satellite.dto'

@ApiTags('satellites')
@Controller('satellites')
export class SatellitesController {
  constructor(private service: SatellitesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new satellite record' })
  async create(@Body() dto: CreateSatelliteDto) {
    return this.service.create(dto)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get satellite statistics' })
  async getStats() {
    return this.service.getStats()
  }

  @Get()
  @ApiOperation({ summary: 'List all satellites' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.findAll(skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 100)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get satellite by ID' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id)
  }

  @Get('norad/:noradId')
  @ApiOperation({ summary: 'Get satellite by NORAD ID' })
  async findByNoradId(@Param('noradId') noradId: string) {
    return this.service.findByNoradId(parseInt(noradId, 10))
  }
}
