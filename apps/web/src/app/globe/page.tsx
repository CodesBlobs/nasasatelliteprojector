'use client'

import dynamic from 'next/dynamic'

const GlobeView = dynamic(() => import('@/components/globe/GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-950">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin 
  mx-auto" />
        <p className="text-slate-400 text-sm">Initializing 3D Globe…</p>
      </div>
    </div>
  ),
})

export default function GlobePage() {
  return (
    <div className="flex-1 min-h-0 relative">
      <GlobeView />
    </div>
  )
}