import { NotFoundException } from '@nestjs/common'

export class SatelliteNotFoundException extends NotFoundException {
  constructor(noradId: number) {
    super({
      statusCode: 404,
      message: `Satellite with NORAD ID ${noradId} not found`,
      error: 'SatelliteNotFound',
    })
  }
}
