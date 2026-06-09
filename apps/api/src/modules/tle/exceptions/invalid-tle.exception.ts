import { BadRequestException } from '@nestjs/common'

export class InvalidTleException extends BadRequestException {
  constructor(message: string) {
    super({
      statusCode: 400,
      message: `Invalid TLE: ${message}`,
      error: 'InvalidTLE',
    })
  }
}
