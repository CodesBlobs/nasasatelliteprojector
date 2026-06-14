import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}

export class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  password: string
}
