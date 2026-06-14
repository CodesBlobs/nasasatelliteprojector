'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MarkdownContent } from '@/components/ai/MarkdownContent'
import { MissionBriefing } from '@/components/ai/MissionBriefing'
import { ConjunctionAnalysis } from '@/components/ai/ConjunctionAnalysis'
import { SimulationAnalysis } from '@/components/ai/SimulationAnalysis'
import { api } from '@/lib/api-client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type Tab = 'chat' | 'briefing' | 'analysis'

function CopilotApp() {
  const params = useSearchParams()
  const conjunctionId = params.get('conjunctionId')
  const simulationId = params.get('simulationId')

  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Broadcast focus events back to the main globe window
  const bc = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    bc.current = new BroadcastChannel('orbital-copilot')
    return () => bc.current?.close()
  }, [])
  const onFocusSatellite = useCallback((noradId: number) => {
    bc.current?.postMessage({ type: 'focus-satellite', noradId })
  }, [])
  const onFocusConjunction = useCallback((id: string) => {
    bc.current?.postMessage({ type: 'focus-conjunction', id })
  }, [])

  const hasAnalysisTarget = conjunctionId !== null || simulationId !== null

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const result = await api.ai.chat(text)
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error reaching AI — check API logs.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">✦</span>
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            AI Copilot
          </span>
          <span className="text-[10px] text-slate-600 uppercase tracking-widest ml-1">
            Orbital Mission Control
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900 flex-shrink-0">
        {(['chat', 'briefing', 'analysis'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={t === 'analysis' && !hasAnalysisTarget}
            className={`px-6 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              tab === t
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            } ${t === 'analysis' && !hasAnalysisTarget ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'chat' && (
          <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500 italic text-center py-8">
                Ask anything about your satellites, conjunctions, or orbital operations.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                  {m.role === 'user' ? 'You' : 'Copilot'}
                </span>
                <div
                  className={`px-3 py-2 rounded-xl text-sm leading-relaxed max-w-[85%] break-words ${
                    m.role === 'user'
                      ? 'bg-cyan-900 text-cyan-100 border border-cyan-800'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 w-full max-w-full'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <MarkdownContent
                      content={m.content}
                      onFocusSatellite={onFocusSatellite}
                      onFocusConjunction={onFocusConjunction}
                    />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <span className="animate-pulse">✦</span>
                <span className="animate-pulse">Thinking…</span>
              </div>
            )}
          </div>
        )}

        {tab === 'briefing' && (
          <div className="p-4 max-w-3xl mx-auto text-sm">
            <MissionBriefing
              onFocusSatellite={onFocusSatellite}
              onFocusConjunction={onFocusConjunction}
            />
          </div>
        )}

        {tab === 'analysis' && hasAnalysisTarget && (
          <div className="p-4 max-w-3xl mx-auto text-sm">
            {conjunctionId && (
              <ConjunctionAnalysis
                conjunctionId={conjunctionId}
                onFocusSatellite={onFocusSatellite}
                onFocusConjunction={onFocusConjunction}
              />
            )}
            {!conjunctionId && simulationId && (
              <SimulationAnalysis
                simulationId={simulationId}
                onFocusSatellite={onFocusSatellite}
                onFocusConjunction={onFocusConjunction}
              />
            )}
          </div>
        )}
      </div>

      {/* Chat input */}
      {tab === 'chat' && (
        <div className="border-t border-slate-800 p-3 flex gap-3 items-end flex-shrink-0 bg-slate-900">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the copilot…"
            disabled={loading}
            rows={2}
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-cyan-600 text-sm text-slate-200 placeholder-slate-600 rounded-xl px-3 py-2 resize-none outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors self-end"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}

export default function AICopilotPage() {
  return (
    <Suspense>
      <CopilotApp />
    </Suspense>
  )
}
