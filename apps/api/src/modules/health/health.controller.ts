import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { HealthService } from './health.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    return this.health.check()
  }
}
