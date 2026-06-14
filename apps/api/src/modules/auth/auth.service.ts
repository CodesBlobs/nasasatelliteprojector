import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { hash, compare } from 'bcryptjs'
import { PrismaService } from '../../common/prisma/prisma.service'
import type { RegisterDto, LoginDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already registered')

    const hashed = await hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: hashed },
    })

    return { token: this.sign(user), user: { id: user.id, email: user.email, name: user.name } }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw new UnauthorizedException('Invalid credentials')

    const valid = await compare(dto.password, user.password)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    return { token: this.sign(user), user: { id: user.id, email: user.email, name: user.name } }
  }

  private sign(user: { id: string; email: string; name: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, name: user.name })
  }
}
