import { UnprocessableEntityException } from '@nestjs/common'

export class PropagationFailedException extends UnprocessableEntityException {
  constructor(message: string) {
    super({
      statusCode: 422,
      message: `Propagation failed: ${message}`,
      error: 'PropagationFailed',
    })
  }
}
