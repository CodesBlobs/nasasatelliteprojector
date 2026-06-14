import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ChatDto {
  @ApiProperty({ description: 'Message to the AI copilot', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  message: string

  @ApiProperty({ description: 'Existing chat ID to continue (optional)', required: false })
  @IsString()
  @IsOptional()
  chatId?: string
}
