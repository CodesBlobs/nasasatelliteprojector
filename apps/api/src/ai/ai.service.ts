import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { AiContextBuilder } from './ai-context-builder'
import { ChatsService } from '../modules/chats/chats.service'
import {
  MISSION_CONTROL_SYSTEM_PROMPT,
  CHAT_SYSTEM_CONTEXT,
  BRIEFING_PROMPT,
  CONJUNCTION_EXPLAIN_PROMPT,
  ALERT_EXPLAIN_PROMPT,
  SIMULATION_ANALYZE_PROMPT,
  RECOMMENDATIONS_PROMPT,
} from './ai-prompts'

const OLLAMA_ENDPOINT = 'https://ollama.com/v1/chat/completions'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gpt-oss:120b-cloud'
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  response: string
  expiresAt: number
}

interface OllamaResponse {
  choices: Array<{ message: { content: string } }>
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly cache = new Map<string, CacheEntry>()

  constructor(
    private contextBuilder: AiContextBuilder,
    private chats: ChatsService,
  ) {
    if (!process.env.OLLAMA_API_KEY) {
      this.logger.warn('OLLAMA_API_KEY is not set — AI endpoints will return 503')
    }
  }

  private getCached(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.response
  }

  private setCache(key: string, response: string): void {
    this.cache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  private async callAI(userPrompt: string): Promise<string> {
    const apiKey = process.env.OLLAMA_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI service unavailable — set OLLAMA_API_KEY in .env and restart the API',
      )
    }

    let res: Response
    try {
      res = await fetch(OLLAMA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: 'system', content: MISSION_CONTROL_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      })
    } catch (err) {
      this.logger.error('AI network error', err)
      throw new ServiceUnavailableException('AI request failed — network error')
    }

    if (res.status === 401) {
      throw new ServiceUnavailableException('AI service unavailable — check OLLAMA_API_KEY in .env')
    }
    if (res.status === 429) {
      throw new ServiceUnavailableException('AI rate limit reached — try again shortly')
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.logger.error(`AI API error ${res.status}: ${body}`)
      throw new ServiceUnavailableException('AI request failed — check API logs')
    }

    const data = (await res.json()) as OllamaResponse
    return data.choices?.[0]?.message?.content ?? ''
  }

  async chat(
    message: string,
    userId?: string,
    chatId?: string,
  ): Promise<{ response: string; chatId?: string }> {
    const context = await this.contextBuilder.buildChatContext()
    const prompt = `${CHAT_SYSTEM_CONTEXT(context)}\n\nOperator question: ${message}`
    this.logger.log(`AI chat: ${message.slice(0, 80)}`)
    const response = await this.callAI(prompt)

    if (userId) {
      try {
        if (chatId) {
          await this.chats.appendMessages(userId, chatId, message, response)
          return { response, chatId }
        } else {
          const chat = await this.chats.createChat(userId, message, response)
          return { response, chatId: chat.id }
        }
      } catch (err) {
        this.logger.warn('Failed to save chat message', err)
      }
    }

    return { response }
  }

  async briefing(): Promise<{ response: string; cached: boolean }> {
    const cacheKey = 'briefing'
    const cached = this.getCached(cacheKey)
    if (cached) return { response: cached, cached: true }

    const context = await this.contextBuilder.buildBriefingContext()
    const prompt = BRIEFING_PROMPT(context)
    this.logger.log('Generating mission briefing')
    const response = await this.callAI(prompt)
    this.setCache(cacheKey, response)
    return { response, cached: false }
  }

  async explainConjunction(conjunctionId: string): Promise<{ response: string }> {
    const cacheKey = `conjunction:${conjunctionId}`
    const cached = this.getCached(cacheKey)
    if (cached) return { response: cached }

    const context = await this.contextBuilder.buildConjunctionContext(conjunctionId)
    if (!context) throw new NotFoundException(`Conjunction ${conjunctionId} not found`)

    const prompt = CONJUNCTION_EXPLAIN_PROMPT(context)
    this.logger.log(`Explaining conjunction: ${conjunctionId}`)
    const response = await this.callAI(prompt)
    this.setCache(cacheKey, response)
    return { response }
  }

  async explainAlert(alertId: string): Promise<{ response: string }> {
    const cacheKey = `alert:${alertId}`
    const cached = this.getCached(cacheKey)
    if (cached) return { response: cached }

    const context = await this.contextBuilder.buildAlertContext(alertId)
    if (!context) throw new NotFoundException(`Alert ${alertId} not found`)

    const prompt = ALERT_EXPLAIN_PROMPT(context)
    this.logger.log(`Explaining alert: ${alertId}`)
    const response = await this.callAI(prompt)
    this.setCache(cacheKey, response)
    return { response }
  }

  async analyzeSimulation(simulationId: string): Promise<{ response: string }> {
    const cacheKey = `simulation:${simulationId}`
    const cached = this.getCached(cacheKey)
    if (cached) return { response: cached }

    const context = await this.contextBuilder.buildSimulationContext(simulationId)
    if (!context) throw new NotFoundException(`Simulation ${simulationId} not found`)

    const prompt = SIMULATION_ANALYZE_PROMPT(context)
    this.logger.log(`Analyzing simulation: ${simulationId}`)
    const response = await this.callAI(prompt)
    this.setCache(cacheKey, response)
    return { response }
  }

  async conjunctionRecommendations(conjunctionId: string): Promise<{ response: string }> {
    const cacheKey = `recommendations:${conjunctionId}`
    const cached = this.getCached(cacheKey)
    if (cached) return { response: cached }

    const context = await this.contextBuilder.buildConjunctionContext(conjunctionId)
    if (!context) throw new NotFoundException(`Conjunction ${conjunctionId} not found`)

    const prompt = RECOMMENDATIONS_PROMPT(context)
    this.logger.log(`Generating recommendations for conjunction: ${conjunctionId}`)
    const response = await this.callAI(prompt)
    this.setCache(cacheKey, response)
    return { response }
  }
}
