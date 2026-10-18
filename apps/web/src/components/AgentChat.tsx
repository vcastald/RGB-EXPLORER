import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
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

interface StartResponse {
  ready?: boolean
  error?: string
}

function normalizeMarkdown(text: string): string {
  return text
    // Unescape common Markdown markers.
    .replace(/\\([*`_])/g, '$1')
    // Replace HTML space entities.
    .replace(/&#x20;|&#32;|&nbsp;/gi, ' ')
    // Restore common single-line bullet lists.
    .replace(/\s+(\*|-)\s+(?=\*\*)/g, '\n$1 ')
    .trim()
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState('')

  const [conversationId] = useState(() => crypto.randomUUID())

  const getTimestamp = () =>
    new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleStartChat = async () => {
    if (starting || started) return

    setStarting(true)
    setError('')

    try {
      const response = await fetch('/api/chat/start', {
        method: 'POST',
      })

      const data = (await response.json()) as StartResponse

      if (!response.ok || !data.ready) {
        throw new Error(data.error || 'Failed to initialize the AI agent.')
      }

      setStarted(true)
      setMessages([
        {
          id: `msg-${crypto.randomUUID()}`,
          sender: 'agent',
          text: "## Hello! I'm your RGB Assistant ⚡\n\nI can help you monitor your RGB infrastructure, inspect treasury balances, review Lightning channels, and analyze potential swaps.\n\n**What would you like to explore today?**",
          timestamp: getTimestamp(),
        },
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start the AI agent.',
      )
    } finally {
      setStarting(false)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const message = inputText.trim()

    if (!started || !message || loading) return

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
    if (!started || loading) return
    setInputText(prompt)
  }

  const markdownClasses =
    'min-w-0 [&_a]:text-amber-300 [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-950 [&_code]:px-1 [&_em]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-semibold [&_hr]:my-3 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-bold [&_strong]:text-white [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20 backdrop-blur-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 shadow-md shadow-indigo-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-amber-400">
              <LightningIcon className="h-4 w-4" />
            </div>

            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${
                starting
                  ? 'bg-amber-400'
                  : started
                    ? 'bg-emerald-500'
                    : 'bg-slate-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white">
                RGB AI Assistant
              </h3>
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
                Agent
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Treasury &amp; Lightning Operations
            </p>
          </div>
        </div>

        <span className="font-mono text-[10px] text-slate-400">
          v0.1-preview
        </span>
      </div>

      {/* Quick Prompts: visible only after startup */}
      {started && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800/60 p-2.5 text-xs custom-scrollbar">
          <button
            type="button"
            onClick={() => handleSuggestedPrompt('Summarize treasury balances')}
            disabled={loading}
            className="flex-shrink-0 cursor-pointer rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:border-amber-400/50 hover:text-white disabled:opacity-50"
          >
            📊 Treasury Summary
          </button>

          <button
            type="button"
            onClick={() =>
              handleSuggestedPrompt('Suggest swaps to rebalance USDT')
            }
            disabled={loading}
            className="flex-shrink-0 cursor-pointer rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:border-amber-400/50 hover:text-white disabled:opacity-50"
          >
            ⚖️ Suggest Swaps
          </button>

          <button
            type="button"
            onClick={() =>
              handleSuggestedPrompt('Check RGB channels and liquidity status')
            }
            disabled={loading}
            className="flex-shrink-0 cursor-pointer rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:border-amber-400/50 hover:text-white disabled:opacity-50"
          >
            ⚡ RGB Channels
          </button>
        </div>
      )}

      {/* Messages / Startup Screen */}
      <div
        aria-live="polite"
        className="flex-1 min-h-0 space-y-3.5 overflow-y-auto p-3.5 sm:p-4 custom-scrollbar"
      >
        {!started ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
              <LightningIcon className="h-7 w-7" />
            </div>

            <h2 className="mb-2 text-lg font-bold text-white">
              RGB Explorer
            </h2>

            <p className="mb-6 max-w-sm text-xs leading-relaxed text-slate-400">
              Press Start Agent to initialize the process.
            </p>

            <button
              type="button"
              onClick={handleStartChat}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  Connecting and loading model...
                </>
              ) : (
                <>
                  <LightningIcon className="h-4 w-4" />
                  Start Chat
                </>
              )}
            </button>

            {starting && (
              <p className="mt-3 text-[11px] text-slate-400">
                The first launch may take a little while.
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  {msg.sender === 'user' ? 'You' : 'RGB Assistant'}
                </span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] break-words rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'whitespace-pre-wrap rounded-tr-sm bg-amber-500 font-medium text-slate-950 shadow-md'
                    : 'rounded-tl-sm border border-slate-700/60 bg-slate-800/80 text-slate-200 shadow-sm'
                }`}
              >
                {msg.sender === 'agent' ? (
                  <div className={markdownClasses}>
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                      {normalizeMarkdown(msg.text)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))
        )}

        {started && loading && (
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
      <div className="border-t border-slate-800 bg-slate-950/50 p-3">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              started
                ? 'Ask the agent a question or give an instruction...'
                : 'Start the chat to begin...'
            }
            disabled={!started || loading}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-3.5 pr-10 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/60 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!started || loading || !inputText.trim()}
            className="absolute right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-amber-400 text-slate-950 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            title="Send message"
            aria-label="Send message"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>

        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          {starting
            ? 'Connecting to Kaleido MCP and loading the local model'
            : loading
              ? 'Local AI agent is processing your request'
              : started
                ? 'Connected via API • Local model'
                : 'AI agent stopped • Start the chat to connect'}
        </p>
      </div>
    </div>
  )
}
