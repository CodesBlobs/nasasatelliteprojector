import { IsString, IsNumber, IsOptional, IsISO8601, ValidateNested, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class DeltaVDto {
  @ApiProperty({ description: 'Delta-V x component (m/s)' })
  @IsNumber()
  x: number

  @ApiProperty({ description: 'Delta-V y component (m/s)' })
  @IsNumber()
  y: number

  @ApiProperty({ description: 'Delta-V z component (m/s)' })
  @IsNumber()
  z: number
}

export class CreateSimulationDto {
  @ApiProperty({ description: 'Satellite database ID' })
  @IsString()
  satelliteId: string

  @ApiProperty({ type: DeltaVDto, description: 'Delta-V vector in m/s (ECI frame)' })
  @ValidateNested()
  @Type(() => DeltaVDto)
  deltaV: DeltaVDto

  @ApiPropertyOptional({ description: 'Prediction window in hours (default 24)', minimum: 1, maximum: 72 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(72)
  windowHours?: number

  @ApiPropertyOptional({ description: 'Maneuver epoch (ISO 8601). Defaults to current time.' })
  @IsOptional()
  @IsISO8601()
  maneuverTime?: string
}
