'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { MarkdownContent, type OrbitalLinkHandlers } from './MarkdownContent'

export function MissionBriefing({ onFocusSatellite, onFocusConjunction }: OrbitalLinkHandlers) {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cached, setCached] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await api.ai.briefing()
      setBriefing(result.response)
      setCached(result.cached)
    } catch {
      setBriefing('Could not generate briefing — check that OLLAMA_API_KEY is set.')
    } finally {
      setLoading(false)
    }
  }

  if (!briefing && !loading) {
    return (
      <button
        onClick={load}
        className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-700/50 hover:border-cyan-500 text-cyan-400 rounded-lg py-2 text-xs font-medium transition-colors"
      >
        Generate Mission Briefing
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
          <span className="animate-pulse">Generating briefing…</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Mission Briefing
            </span>
            <div className="flex items-center gap-2">
              {cached && <span className="text-[10px] text-slate-600">cached</span>}
              <button
                onClick={load}
                className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <MarkdownContent
              content={briefing!}
              onFocusSatellite={onFocusSatellite}
              onFocusConjunction={onFocusConjunction}
            />
          </div>
        </>
      )}
    </div>
  )
}
