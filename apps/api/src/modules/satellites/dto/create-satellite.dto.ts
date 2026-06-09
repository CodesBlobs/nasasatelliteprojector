import { IsNumber, IsString, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateSatelliteDto {
  @ApiProperty({ example: 25544 })
  @IsNumber()
  noradId: number

  @ApiProperty({ example: 'ISS (ZARYA)' })
  @IsString()
  name: string

  @ApiProperty({ example: 'Roskosmos', required: false })
  @IsOptional()
  @IsString()
  operator?: string

  @ApiProperty({ example: 'Russia', required: false })
  @IsOptional()
  @IsString()
  country?: string

  @ApiProperty({ example: 'Payload' })
  @IsString()
  objectType: string
}
