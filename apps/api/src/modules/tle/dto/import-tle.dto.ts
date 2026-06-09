import { IsString, Length, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ImportTleDto {
  @ApiProperty({
    example: 'ISS (ZARYA)',
    description: 'Satellite name',
  })
  @IsString()
  @MinLength(1)
  name: string

  @ApiProperty({
    example: '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005',
    description: 'TLE Line 1 (exactly 69 characters)',
  })
  @IsString()
  @Length(69, 69)
  line1: string

  @ApiProperty({
    example: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645',
    description: 'TLE Line 2 (exactly 69 characters)',
  })
  @IsString()
  @Length(69, 69)
  line2: string

  @ApiProperty({
    example: 'Russia',
    description: 'Country of origin (optional)',
    required: false,
  })
  @IsString()
  country?: string

  @ApiProperty({
    example: 'RKA',
    description: 'Satellite operator (optional)',
    required: false,
  })
  @IsString()
  operator?: string
}
