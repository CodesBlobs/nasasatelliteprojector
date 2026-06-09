import { IsISO8601, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PropagateQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 8601 UTC timestamp to propagate to',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  time?: string
}
