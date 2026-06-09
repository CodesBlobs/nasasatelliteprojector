'use client'

export default function AlertsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-white mb-8">Alerts</h1>

      <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
        <h2 className="text-xl font-semibold text-slate-300 mb-2">No Active Alerts</h2>
        <p className="text-slate-400">
          Conjunction detection will be available after satellites are loaded and analyzed.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-900 bg-opacity-20 rounded p-4 border border-red-700">
            <p className="text-red-300 font-semibold">CRITICAL</p>
            <p className="text-sm text-slate-400 mt-1">{"< 100m approach"}</p>
          </div>
          <div className="bg-orange-900 bg-opacity-20 rounded p-4 border border-orange-700">
            <p className="text-orange-300 font-semibold">HIGH</p>
            <p className="text-sm text-slate-400 mt-1">100m - 1km approach</p>
          </div>
          <div className="bg-yellow-900 bg-opacity-20 rounded p-4 border border-yellow-700">
            <p className="text-yellow-300 font-semibold">MEDIUM</p>
            <p className="text-sm text-slate-400 mt-1">1km - 10km approach</p>
          </div>
        </div>
      </div>
    </div>
  )
}
