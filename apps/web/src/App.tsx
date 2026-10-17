import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('Checking…')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json() as Promise<{ status: string }>
      })
      .then((data) => setStatus(data.status === 'ok' ? 'Connected' : 'Unavailable'))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) setStatus('Unavailable')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto mt-[12vh] max-w-2xl px-8 text-slate-100">
      <h1 className="mb-2 text-4xl font-bold">RGB Explorer</h1>
      <p className="text-slate-300">Your development workspace is ready.</p>
      <p className="mt-6 text-slate-300">API: <strong className="text-emerald-300">{status}</strong></p>
    </main>
  )
}
