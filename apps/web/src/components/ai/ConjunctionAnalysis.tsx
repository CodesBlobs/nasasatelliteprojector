'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { MarkdownContent, type OrbitalLinkHandlers } from './MarkdownContent'

interface Props extends OrbitalLinkHandlers {
  conjunctionId: string
}

type View = 'explain' | 'recommendations'

export function ConjunctionAnalysis({ conjunctionId, onFocusSatellite, onFocusConjunction }: Props) {
  const [view, setView] = useState<View>('explain')
  const [explain, setExplain] = useState<string | null>(null)
  const [recs, setRecs] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (target: View) => {
    setView(target)
    const current = target === 'explain' ? explain : recs
    if (current) return

    setLoading(true)
    try {
      if (target === 'explain') {
        const r = await api.ai.explainConjunction(conjunctionId)
        setExplain(r.response)
      } else {
        const r = await api.ai.conjunctionRecommendations(conjunctionId)
        setRecs(r.response)
      }
    } catch {
      const err = 'Could not load AI analysis.'
      if (target === 'explain') setExplain(err)
      else setRecs(err)
    } finally {
      setLoading(false)
    }
  }

  const active = view === 'explain' ? explain : recs

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => load('explain')}
          className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
            view === 'explain'
              ? 'bg-cyan-700 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Explain
        </button>
        <button
          onClick={() => load('recommendations')}
          className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
            view === 'recommendations'
              ? 'bg-cyan-700 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Recommendations
        </button>
      </div>

      {loading && (
        <div className="text-xs text-slate-400 py-4 text-center animate-pulse">Analyzing…</div>
      )}

      {!loading && !active && (
        <button
          onClick={() => load(view)}
          className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-700/50 hover:border-cyan-500 text-cyan-400 rounded-lg py-2 text-xs font-medium transition-colors"
        >
          {view === 'explain' ? 'Explain This Conjunction' : 'Get Maneuver Recommendations'}
        </button>
      )}

      {!loading && active && (
        <div className="text-xs text-slate-300 leading-relaxed">
          <MarkdownContent
            content={active}
            onFocusSatellite={onFocusSatellite}
            onFocusConjunction={onFocusConjunction}
          />
        </div>
      )}
    </div>
  )
}
