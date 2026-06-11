'use client'

interface Props {
  showOriginal: boolean
  showSimulated: boolean
  onToggleOriginal: () => void
  onToggleSimulated: () => void
  onClear: () => void
}

export default function OrbitComparison({
  showOriginal,
  showSimulated,
  onToggleOriginal,
  onToggleSimulated,
  onClear,
}: Props) {
  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-[10px] uppercase tracking-wider">Orbits</span>

        <button
          onClick={onToggleOriginal}
          className={`flex items-center gap-1.5 transition-opacity ${showOriginal ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="inline-block w-4 h-0.5 bg-cyan-400 rounded" />
          <span className="text-slate-300 text-[10px]">Original</span>
        </button>

        <button
          onClick={onToggleSimulated}
          className={`flex items-center gap-1.5 transition-opacity ${showSimulated ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="inline-block w-4 h-0.5 bg-green-400 rounded" />
          <span className="text-slate-300 text-[10px]">Simulated</span>
        </button>

        <button
          onClick={onClear}
          className="text-slate-500 hover:text-slate-300 text-[10px] ml-1 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
