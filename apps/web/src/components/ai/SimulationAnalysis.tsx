'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { MarkdownContent, type OrbitalLinkHandlers } from './MarkdownContent'

interface Props extends OrbitalLinkHandlers {
  simulationId: string
}

export function SimulationAnalysis({ simulationId, onFocusSatellite, onFocusConjunction }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAnalysis(null)
  }, [simulationId])

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.ai.analyzeSimulation(simulationId)
      setAnalysis(r.response)
    } catch {
      setAnalysis('Could not load simulation analysis.')
    } finally {
      setLoading(false)
    }
  }

  if (!analysis && !loading) {
    return (
      <button
        onClick={load}
        className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-700/50 hover:border-cyan-500 text-cyan-400 rounded-lg py-2 text-xs font-medium transition-colors"
      >
        Analyze Simulation
      </button>
    )
  }

  if (loading) {
    return (
      <div className="text-xs text-slate-400 py-4 text-center animate-pulse">
        Analyzing maneuver…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Simulation Analysis
        </span>
        <button
          onClick={load}
          className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="text-xs text-slate-300 leading-relaxed">
        <MarkdownContent
          content={analysis!}
          onFocusSatellite={onFocusSatellite}
          onFocusConjunction={onFocusConjunction}
        />
      </div>
    </div>
  )
}
