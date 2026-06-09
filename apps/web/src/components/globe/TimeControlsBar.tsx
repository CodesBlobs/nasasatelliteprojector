'use client'

const SPEEDS = [1, 10, 100, 1000] as const
type Speed = (typeof SPEEDS)[number]

interface Props {
  simulatedTime: Date
  isPlaying: boolean
  timeSpeed: Speed
  onPlayPause: () => void
  onSpeedChange: (speed: Speed) => void
  onTimeShift: (deltaMs: number) => void
}

export function TimeControlsBar({
  simulatedTime,
  isPlaying,
  timeSpeed,
  onPlayPause,
  onSpeedChange,
  onTimeShift,
}: Props) {
  const timeStr = simulatedTime.toUTCString().replace(' GMT', ' UTC')

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg backdrop-blur-sm px-4 py-2 flex items-center gap-4">
      {/* Back 10 min */}
      <button
        onClick={() => onTimeShift(-10 * 60 * 1000)}
        className="text-slate-400 hover:text-white transition text-sm px-1"
        title="Back 10 minutes"
      >
        ◀◀
      </button>

      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-cyan-600 hover:bg-cyan-500 transition text-white"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Forward 10 min */}
      <button
        onClick={() => onTimeShift(10 * 60 * 1000)}
        className="text-slate-400 hover:text-white transition text-sm px-1"
        title="Forward 10 minutes"
      >
        ▶▶
      </button>

      <div className="w-px h-5 bg-slate-700" />

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-0.5 rounded text-xs font-mono transition ${
              timeSpeed === s
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Current simulated time */}
      <span className="text-xs font-mono text-slate-300 whitespace-nowrap">{timeStr}</span>
    </div>
  )
}
