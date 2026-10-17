import React, { useState } from 'react'
import { LightningIcon } from './Icons'

interface ChatMessage {
  id: string
  sender: 'agent' | 'user'
  text: string
  timestamp: string
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      text: '👋 Ciao! Sono il tuo assistente AI per la tesoreria RGB su Lightning Network. Posso analizzare gli incassi, verificare la ripartizione degli asset o preparare transazioni di swap.',
      timestamp: '10:45',
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: 'Qual è il riepilogo degli incassi registrati oggi e il bilanciamento tra USDT e XAUT?',
      timestamp: '10:46',
    },
    {
      id: 'msg-3',
      sender: 'agent',
      text: 'Oggi hai registrato pagamenti in ingresso per 1.789,90 USDT, 1.750 XAUT e 0.1465 BTC. La tua quota in oro (XAUT) costituisce circa il 29% del valore incassato, mentre USDT copre l\'11%. Vuoi preparare una proposta di ribilanciamento?',
      timestamp: '10:46',
    },
  ])

  const [inputText, setInputText] = useState('')

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim()) return

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, newMsg])
    setInputText('')

    // Simulate agent placeholder reply after 600ms
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-agent-${Date.now()}`,
          sender: 'agent',
          text: '⚡ [Placeholder AI] Messaggio ricevuto. Il modulo di inferenza LLM locale è in fase di integrazione con il nodo RGB.',
          timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }, 600)
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
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white">RGB AI Assistant</h3>
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300">
                Agent
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Tesoreria & Operazioni LN</p>
          </div>
        </div>

        <span className="text-[10px] text-slate-400 font-mono">v0.1-preview</span>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800/60 p-2.5 text-xs custom-scrollbar">
        <button
          onClick={() => handleSuggestedPrompt('Riepilogo saldo tesoreria')}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer"
        >
          📊 Riepilogo tesoreria
        </button>
        <button
          onClick={() => handleSuggestedPrompt('Proponi swap per bilanciare USDT')}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer"
        >
          ⚖️ Proponi swap
        </button>
        <button
          onClick={() => handleSuggestedPrompt('Stato canali RGB e liquidità')}
          className="flex-shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-400/50 hover:text-white transition-all cursor-pointer"
        >
          ⚡ Canali RGB
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 custom-scrollbar max-h-[500px] lg:max-h-[calc(100vh-270px)] min-h-[320px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">
                {msg.sender === 'user' ? 'Tu' : 'RGB Assistant'}
              </span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-sm shadow-md'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input Placeholder */}
      <div className="border-t border-slate-800 p-3 bg-slate-950/50">
        <form onSubmit={handleSendMessage} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Chiedi all'agente o dai un'istruzione..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-3.5 pr-10 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-slate-950 transition-all hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Invia messaggio"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          Interfaccia anteprima AI Agent • In attesa del modello locale
        </p>
      </div>
    </aside>
  )
}
