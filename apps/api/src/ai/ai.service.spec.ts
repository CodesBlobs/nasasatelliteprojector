import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { AiService } from './ai.service'
import { AiContextBuilder } from './ai-context-builder'

process.env.OLLAMA_API_KEY = 'test-key'

const MOCK_RESPONSE = 'AI analysis complete.'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockOllamaOk(text = MOCK_RESPONSE) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content: text } }] }),
  })
}

const mockContextBuilder = {
  buildChatContext: vi.fn().mockResolvedValue('{"systemState":{"totalSatellites":10}}'),
  buildBriefingContext: vi.fn().mockResolvedValue('{"fleet":{"totalSatellites":10}}'),
  buildConjunctionContext: vi.fn(),
  buildAlertContext: vi.fn(),
  buildSimulationContext: vi.fn(),
}

describe('AiService', () => {
  let service: AiService

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOllamaOk()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiContextBuilder, useValue: mockContextBuilder },
      ],
    }).compile()

    service = module.get<AiService>(AiService)
    ;(service as any).cache.clear()
  })

  describe('chat', () => {
    it('returns AI response for a message', async () => {
      const result = await service.chat('How many satellites are tracked?')
      expect(result.response).toBe(MOCK_RESPONSE)
      expect(mockContextBuilder.buildChatContext).toHaveBeenCalledOnce()
    })

    it('calls the Ollama endpoint with system + user messages', async () => {
      await service.chat('test message')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ollama.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        }),
      )
    })
  })

  describe('briefing', () => {
    it('returns briefing on first call', async () => {
      const result = await service.briefing()
      expect(result.response).toBe(MOCK_RESPONSE)
      expect(result.cached).toBe(false)
    })

    it('returns cached briefing on second call', async () => {
      await service.briefing()
      const result = await service.briefing()
      expect(result.cached).toBe(true)
      expect(mockContextBuilder.buildBriefingContext).toHaveBeenCalledOnce()
    })
  })

  describe('explainConjunction', () => {
    it('returns explanation when conjunction exists', async () => {
      mockContextBuilder.buildConjunctionContext.mockResolvedValueOnce('{"conjunction":{"id":"abc"}}')
      const result = await service.explainConjunction('abc')
      expect(result.response).toBe(MOCK_RESPONSE)
    })

    it('throws NotFoundException when conjunction does not exist', async () => {
      mockContextBuilder.buildConjunctionContext.mockResolvedValueOnce(null)
      await expect(service.explainConjunction('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('caches the response', async () => {
      mockContextBuilder.buildConjunctionContext.mockResolvedValue('{"conjunction":{"id":"abc"}}')
      await service.explainConjunction('abc')
      await service.explainConjunction('abc')
      expect(mockContextBuilder.buildConjunctionContext).toHaveBeenCalledOnce()
    })
  })

  describe('explainAlert', () => {
    it('returns explanation when alert exists', async () => {
      mockContextBuilder.buildAlertContext.mockResolvedValueOnce('{"alert":{"id":"xyz"}}')
      const result = await service.explainAlert('xyz')
      expect(result.response).toBe(MOCK_RESPONSE)
    })

    it('throws NotFoundException when alert does not exist', async () => {
      mockContextBuilder.buildAlertContext.mockResolvedValueOnce(null)
      await expect(service.explainAlert('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('analyzeSimulation', () => {
    it('returns analysis when simulation exists', async () => {
      mockContextBuilder.buildSimulationContext.mockResolvedValueOnce('{"simulation":{"id":"sim1"}}')
      const result = await service.analyzeSimulation('sim1')
      expect(result.response).toBe(MOCK_RESPONSE)
    })

    it('throws NotFoundException when simulation does not exist', async () => {
      mockContextBuilder.buildSimulationContext.mockResolvedValueOnce(null)
      await expect(service.analyzeSimulation('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('conjunctionRecommendations', () => {
    it('returns recommendations when conjunction exists', async () => {
      mockContextBuilder.buildConjunctionContext.mockResolvedValueOnce('{"conjunction":{"id":"abc"}}')
      const result = await service.conjunctionRecommendations('abc')
      expect(result.response).toBe(MOCK_RESPONSE)
    })

    it('throws NotFoundException when conjunction does not exist', async () => {
      mockContextBuilder.buildConjunctionContext.mockResolvedValueOnce(null)
      await expect(service.conjunctionRecommendations('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
