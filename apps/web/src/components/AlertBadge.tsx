interface Props {
  severity: string
  count?: number
  size?: 'sm' | 'md'
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-950 border-red-500 text-red-300',
  HIGH:     'bg-orange-950 border-orange-500 text-orange-300',
  MEDIUM:   'bg-yellow-950 border-yellow-500 text-yellow-300',
  LOW:      'bg-blue-950 border-blue-500 text-blue-300',
  INFO:     'bg-slate-800 border-slate-500 text-slate-300',
}

export function AlertBadge({ severity, count, size = 'sm' }: Props) {
  const style = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.INFO
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded border font-bold uppercase tracking-wider ${padding} ${style}`}>
      {severity}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-white/10 px-1 font-mono">{count}</span>
      )}
    </span>
  )
}
