import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ScanDto {
  @ApiPropertyOptional({ description: 'Detection window in hours', default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  windowHours?: number

  @ApiPropertyOptional({ description: 'Sample interval in minutes', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  sampleMinutes?: number

  @ApiPropertyOptional({ description: 'Close-approach threshold in km', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  thresholdKm?: number
}
