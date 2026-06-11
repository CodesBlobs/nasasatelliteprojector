import { IsEnum } from 'class-validator'
import { AlertStatus } from '@orbital/shared'

export class UpdateAlertStatusDto {
  @IsEnum(AlertStatus)
  status!: AlertStatus
}
