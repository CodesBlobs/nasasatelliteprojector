export function Header() {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orbital</h1>
          <p className="text-sm text-slate-400">Space Traffic Control Platform</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">Status</p>
            <p className="text-xs text-green-400">• Connected</p>
          </div>
        </div>
      </div>
    </header>
  )
}
