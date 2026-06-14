import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class ChatsService {
  constructor(private prisma: PrismaService) {}

  async listChats(userId: string) {
    return this.prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })
  }

  async getChat(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!chat) throw new NotFoundException('Chat not found')
    if (chat.userId !== userId) throw new ForbiddenException()
    return chat
  }

  async createChat(userId: string, userMessage: string, assistantMessage: string) {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? '…' : '')
    return this.prisma.chat.create({
      data: {
        userId,
        title,
        messages: {
          create: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantMessage },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
  }

  async appendMessages(userId: string, chatId: string, userMessage: string, assistantMessage: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) throw new NotFoundException('Chat not found')
    if (chat.userId !== userId) throw new ForbiddenException()

    await this.prisma.chatMessage.createMany({
      data: [
        { chatId, role: 'user', content: userMessage },
        { chatId, role: 'assistant', content: assistantMessage },
      ],
    })
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })
    return { chatId }
  }

  async deleteChat(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) throw new NotFoundException('Chat not found')
    if (chat.userId !== userId) throw new ForbiddenException()
    await this.prisma.chat.delete({ where: { id: chatId } })
  }
}
