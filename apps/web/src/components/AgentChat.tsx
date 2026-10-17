import React, { useState } from 'react'
import { LightningIcon } from './Icons'

interface ChatMessage {
  id: string
  sender: 'agent' | 'user'
  text: string
  timestamp: string
}

interface ChatResponse {
  answer?: string
  conversationId?: string
  error?: string
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      text: '👋 Hi! I’m your AI assistant for RGB treasury management on the Lightning Network. I can analyze incoming payments, check asset allocations, and prepare swap transactions.',
      timestamp: '10:45',
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: 'What is the summary of today’s incoming payments, and how are assets balanced between USDT and XAUT?',
      timestamp: '10:46',
    },
    {
      id: 'msg-3',
      sender: 'agent',
      text: 'This was a demo conversation. You can now query the agent connected to the node through the API.',
      timestamp: '10:46',
    },
  ])

  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [conversationId] = useState(() => crypto.randomUUID())

  const getTimestamp = () =>
    new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const message = inputText.trim()
    if (!message || loading) return

    setInputText('')
    setError('')

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${crypto.randomUUID()}`,
        sender: 'user',
        text: message,
        timestamp: getTimestamp(),
      },
    ])

    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
        }),
      })

      const data = (await response.json()) as ChatResponse

      if (!response.ok) {
        throw new Error(
          data.error || `Server error: HTTP ${response.status}`,
        )
      }

      if (typeof data.answer !== 'string') {
        throw new Error('The API response does not contain the answer field.')
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${crypto.randomUUID()}`,
          sender: 'agent',
          text: data.answer!,
          timestamp: getTimestamp(),
        },
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to communicate with the server.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInputText(prompt)
  }

  return (
    <aside className="flex flex-col w-full lg:w-[360px] xl:w-[390px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 backdrop-blur-md">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 shadow-md shadow-indigo-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-amber-400">
              <LightningIcon className="h-4 w-4" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${
                loading ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white">
                RGB AI Assistant
              </h3>
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300">
                Agent
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Treasury &amp; Lightning Operations
            </p>
          </div>
        </div>

        <span className="text-[10px] text-slate-400 font-mono">
          v0.1-preview
        </span>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800/60 p-2.5 text-xs custom-scrollbar">
        <button
          type="button"
          onClick={() => handleSuggestedPrompt('Summarize treasury balances')}
          disabled={loading}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          📊 Treasury Summary
        </button>
        <button
          type="button"
          onClick={() =>
            handleSuggestedPrompt('Suggest swaps to rebalance USDT')
          }
          disabled={loading}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          ⚖️ Suggest Swaps
        </button>
        <button
          type="button"
          onClick={() =>
            handleSuggestedPrompt('Check RGB channels and liquidity status')
          }
          disabled={loading}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          ⚡ RGB Channels
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div
        aria-live="polite"
        className="flex-1 space-y-3.5 overflow-y-auto p-4 custom-scrollbar max-h-[500px] lg:max-h-[calc(100vh-270px)] min-h-[320px]"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">
                {msg.sender === 'user' ? 'You' : 'RGB Assistant'}
              </span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.sender === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-sm shadow-md'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <div className="mb-1 text-[10px] text-slate-400">
              RGB Assistant
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-300">
              ⚡ The agent is processing your request...
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300"
          >
            Error: {error}
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-800 p-3 bg-slate-950/50">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask the agent a question or give an instruction..."
            disabled={loading}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-3.5 pr-10 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-slate-950 transition-all hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Send message"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          {loading
            ? 'Local AI agent is processing your request'
            : 'Connected via API • Local model'}
        </p>
      </div>
    </aside>
  )
}

