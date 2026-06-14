'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { MarkdownContent, type OrbitalLinkHandlers } from './MarkdownContent'
import { MissionBriefing } from './MissionBriefing'
import { ConjunctionAnalysis } from './ConjunctionAnalysis'
import { SimulationAnalysis } from './SimulationAnalysis'

export type { OrbitalLinkHandlers }

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SavedChat {
  id: string
  title: string
  updatedAt: string
  _count: { messages: number }
}

type Tab = 'chat' | 'briefing' | 'analysis'
type DragMode = 'move' | 'left' | 'bottom' | 'corner' | null

interface Props extends OrbitalLinkHandlers {
  selectedConjunctionId: string | null
  selectedSimulationId: string | null
  onClose: () => void
}

const MIN_W = 280
const MAX_W = 860
const MIN_H = 320
const MAX_H = 920
const DEFAULT_W = 380
const DEFAULT_H = 560

export function AICopilotPanel({
  selectedConjunctionId,
  selectedSimulationId,
  onClose,
  onFocusSatellite: onFocusSatelliteProp,
  onFocusConjunction: onFocusConjunctionProp,
}: Props) {
  const { user } = useAuth()

  const bc = useRef<BroadcastChannel | null>(null)
  useEffect(() => {
    bc.current = new BroadcastChannel('orbital-copilot')
    return () => bc.current?.close()
  }, [])

  const onFocusSatellite = useCallback(
    (noradId: number) => {
      onFocusSatelliteProp?.(noradId)
      bc.current?.postMessage({ type: 'focus-satellite', noradId })
    },
    [onFocusSatelliteProp],
  )

  const onFocusConjunction = useCallback(
    (id: string) => {
      onFocusConjunctionProp?.(id)
      bc.current?.postMessage({ type: 'focus-conjunction', id })
    },
    [onFocusConjunctionProp],
  )

  const [tab, setTab] = useState<Tab>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | undefined>()

  const [showHistory, setShowHistory] = useState(false)
  const [savedChats, setSavedChats] = useState<SavedChat[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [panelW, setPanelW] = useState(DEFAULT_W)
  const [panelH, setPanelH] = useState(DEFAULT_H)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPos({ x: window.innerWidth - DEFAULT_W - 20, y: window.innerHeight - DEFAULT_H - 80 })
    setReady(true)
  }, [])

  const dragMode = useRef<DragMode>(null)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const hasAnalysisTarget = selectedConjunctionId !== null || selectedSimulationId !== null

  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const chats = await api.chats.list()
      setSavedChats(chats)
    } catch {
      // silently ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [user])

  const openHistory = () => {
    setShowHistory(true)
    loadHistory()
  }

  const loadChat = async (chatId: string) => {
    try {
      const chat = await api.chats.get(chatId)
      setMessages(
        chat.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      )
      setActiveChatId(chat.id)
      setShowHistory(false)
      setTab('chat')
    } catch {
      // silently ignore
    }
  }

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    try {
      await api.chats.delete(chatId)
      setSavedChats((prev) => prev.filter((c) => c.id !== chatId))
      if (activeChatId === chatId) {
        setMessages([])
        setActiveChatId(undefined)
      }
    } catch {
      // silently ignore
    }
  }

  const newChat = () => {
    setMessages([])
    setActiveChatId(undefined)
    setShowHistory(false)
    setTab('chat')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const result = await api.ai.chat(text, activeChatId)
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
      if (result.chatId && result.chatId !== activeChatId) {
        setActiveChatId(result.chatId)
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('OLLAMA_API_KEY')
          ? 'AI unavailable — add your OLLAMA_API_KEY to .env and restart the API.'
          : 'Error reaching AI — check API logs.'
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startMove = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      dragMode.current = 'move'
      dragStart.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, w: panelW, h: panelH }
    },
    [pos, panelW, panelH],
  )

  const startResize = useCallback(
    (mode: Exclude<DragMode, 'move' | null>) =>
      (e: React.MouseEvent) => {
        e.preventDefault()
        dragMode.current = mode
        dragStart.current = {
          mx: e.clientX,
          my: e.clientY,
          x: pos.x,
          y: pos.y,
          w: panelW,
          h: panelH,
        }
      },
    [pos, panelW, panelH],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const mode = dragMode.current
      if (!mode) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      if (mode === 'move') {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - panelW, dragStart.current.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.y + dy)),
        })
        return
      }
      if (mode === 'left' || mode === 'corner') {
        const newW = Math.min(MAX_W, Math.max(MIN_W, dragStart.current.w - dx))
        setPanelW(newW)
        setPos((p) => ({ ...p, x: dragStart.current.x + dragStart.current.w - newW }))
      }
      if (mode === 'bottom' || mode === 'corner') {
        setPanelH(Math.min(MAX_H, Math.max(MIN_H, dragStart.current.h + dy)))
      }
    }
    const onUp = () => {
      dragMode.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panelW])

  const popOut = () => {
    const params = new URLSearchParams()
    if (selectedConjunctionId) params.set('conjunctionId', selectedConjunctionId)
    if (selectedSimulationId) params.set('simulationId', selectedSimulationId)
    const url = `/ai-copilot${params.size ? `?${params}` : ''}`
    window.open(url, 'ai-copilot', `width=${panelW + 40},height=${panelH + 40},resizable=yes`)
  }

  if (!ready) return null

  return (
    <div
      className="fixed flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: panelW, height: panelH, zIndex: 9999 }}
    >
      {/* Resize handles */}
      <div
        onMouseDown={startResize('left')}
        className="absolute left-0 top-8 bottom-4 w-1.5 cursor-ew-resize hover:bg-cyan-600/40 rounded-r transition-colors z-10"
      />
      <div
        onMouseDown={startResize('bottom')}
        className="absolute bottom-0 left-4 right-4 h-1.5 cursor-ns-resize hover:bg-cyan-600/40 rounded-t transition-colors z-10"
      />
      <div
        onMouseDown={startResize('corner')}
        className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-20"
      />

      {/* Header */}
      <div
        onMouseDown={startMove}
        className="flex items-center justify-between px-3 py-2 border-b border-slate-700 flex-shrink-0 cursor-grab active:cursor-grabbing select-none bg-slate-800"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-xs">✦</span>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            AI Copilot
          </span>
          {user && activeChatId && (
            <span className="text-[9px] text-slate-600 uppercase tracking-wider">· saved</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {user && (
            <button
              onClick={showHistory ? () => setShowHistory(false) : openHistory}
              title="Chat history"
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                showHistory
                  ? 'text-cyan-400 bg-slate-700'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              ☰
            </button>
          )}
          {user && !showHistory && messages.length > 0 && (
            <button
              onClick={newChat}
              title="New chat"
              className="text-slate-500 hover:text-slate-200 hover:bg-slate-700 text-xs px-1.5 py-0.5 rounded transition-colors"
            >
              ✎
            </button>
          )}
          <button
            onClick={popOut}
            title="Open in new window"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-600 hover:border-cyan-500 hover:text-cyan-400 text-slate-300 text-[10px] font-medium transition-colors bg-slate-700 hover:bg-slate-700/80"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" />
              <path d="M8 1h3v3" />
              <path d="M11 1L6 6" />
            </svg>
            Pop out
          </button>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xs transition-colors ml-0.5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* History overlay */}
      {showHistory && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              Saved Chats
            </span>
            <button
              onClick={newChat}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              + New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {historyLoading && (
              <p className="text-xs text-slate-500 text-center py-6 animate-pulse">Loading…</p>
            )}
            {!historyLoading && savedChats.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6 italic">No saved chats yet</p>
            )}
            {savedChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => loadChat(chat.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-800/60 hover:bg-slate-800 transition-colors group flex items-start justify-between gap-2 ${
                  activeChatId === chat.id ? 'bg-slate-800/80' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate leading-snug">{chat.title}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {chat._count.messages} msg · {new Date(chat.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  role="button"
                  onClick={(e) => deleteChat(e, chat.id)}
                  className="text-slate-700 group-hover:text-red-500 text-[10px] transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
                  title="Delete chat"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      {!showHistory && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-700 flex-shrink-0">
            {(['chat', 'briefing', 'analysis'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                disabled={t === 'analysis' && !hasAnalysisTarget}
                className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  tab === t
                    ? 'text-cyan-400 border-b border-cyan-400'
                    : 'text-slate-500 hover:text-slate-300'
                } ${t === 'analysis' && !hasAnalysisTarget ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === 'chat' && (
              <div className="flex flex-col gap-2 p-3">
                {messages.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-4">
                    {user
                      ? 'Ask anything — your chats are saved automatically.'
                      : 'Ask anything about your satellites, conjunctions, or orbital operations.'}
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-0.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[9px] text-slate-600 uppercase tracking-wider">
                      {m.role === 'user' ? (user?.name ?? 'You') : 'Copilot'}
                    </span>
                    <div
                      className={`px-2.5 py-1.5 rounded-lg text-xs leading-relaxed max-w-full break-words ${
                        m.role === 'user'
                          ? 'bg-cyan-900 text-cyan-100 border border-cyan-800'
                          : 'bg-slate-800 text-slate-200 border border-slate-700 w-full'
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
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <span className="animate-pulse">✦</span>
                    <span className="animate-pulse">Thinking…</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {tab === 'briefing' && (
              <div className="p-3">
                <MissionBriefing
                  onFocusSatellite={onFocusSatellite}
                  onFocusConjunction={onFocusConjunction}
                />
              </div>
            )}

            {tab === 'analysis' && hasAnalysisTarget && (
              <div className="p-3">
                {selectedConjunctionId && (
                  <ConjunctionAnalysis
                    conjunctionId={selectedConjunctionId}
                    onFocusSatellite={onFocusSatellite}
                    onFocusConjunction={onFocusConjunction}
                  />
                )}
                {!selectedConjunctionId && selectedSimulationId && (
                  <SimulationAnalysis
                    simulationId={selectedSimulationId}
                    onFocusSatellite={onFocusSatellite}
                    onFocusConjunction={onFocusConjunction}
                  />
                )}
              </div>
            )}
          </div>

          {/* Chat input */}
          {tab === 'chat' && (
            <div className="border-t border-slate-700 p-2 flex gap-2 items-end flex-shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the copilot…"
                disabled={loading}
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-cyan-600 text-xs text-slate-200 placeholder-slate-600 rounded-lg px-2.5 py-1.5 resize-none outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors self-end"
              >
                Send
              </button>
            </div>
          )}

          {/* Sign-in nudge */}
          {!user && tab === 'chat' && (
            <div className="px-3 py-1.5 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] text-slate-500">Sign in to save chat history</span>
              <a href="/login" className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                Sign in →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
