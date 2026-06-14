import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Copilot — Orbital Mission Control',
}

export default function AICopilotLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen flex flex-col">{children}</div>
}
