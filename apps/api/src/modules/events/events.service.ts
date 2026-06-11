import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Response } from 'express'

interface Subscriber {
  res: Response
  heartbeat: NodeJS.Timeout
}

@Injectable()
export class EventsService implements OnModuleDestroy {
  private subscribers = new Map<number, Subscriber>()
  private nextId = 0

  subscribe(res: Response): () => void {
    const id = this.nextId++

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n')
      } catch {
        this.remove(id)
      }
    }, 30_000)

    this.subscribers.set(id, { res, heartbeat })
    return () => this.remove(id)
  }

  emit(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    const dead: number[] = []

    for (const [id, sub] of this.subscribers) {
      try {
        sub.res.write(payload)
      } catch {
        dead.push(id)
      }
    }

    for (const id of dead) this.remove(id)
  }

  get subscriberCount(): number {
    return this.subscribers.size
  }

  private remove(id: number): void {
    const sub = this.subscribers.get(id)
    if (!sub) return
    clearInterval(sub.heartbeat)
    this.subscribers.delete(id)
  }

  onModuleDestroy(): void {
    for (const sub of this.subscribers.values()) {
      clearInterval(sub.heartbeat)
      try { sub.res.end() } catch { /* ignore */ }
    }
    this.subscribers.clear()
  }
}
