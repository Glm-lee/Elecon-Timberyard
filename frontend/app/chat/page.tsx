'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { chatApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Send, Bot, User, Loader2, MessageCircle, Phone } from 'lucide-react'

const QUICK_PROMPTS = [
  'What timber do you have in stock?',
  'I need structural timber for roofing',
  'What are your hardwood prices?',
  'Can I get a delivery quote to Westlands?',
]

function ChatContent() {
  const searchParams = useSearchParams()
  const source = searchParams.get('source') || 'website'
  const productHint = searchParams.get('product') || ''
  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [started, setStarted] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const startChat = async () => {
    setStarting(true)
    try {
      const sess = await chatApi.startSession({ channel: 'website', source, customer_name: name || undefined, phone: phone || undefined })
      setSession(sess)
      setStarted(true)
      const greeting = productHint
        ? 'Hi' + (name ? ' ' + name : '') + '! I see you are interested in ' + productHint + '. Let me check our current stock and pricing. How many meters do you need?'
        : 'Hello' + (name ? ' ' + name : '') + '! Welcome to Elecon Timberyard. I am your AI sales assistant. I can check stock, give you prices, and prepare quotes instantly. What timber do you need today?'
      setMessages([{ id: '1', sender: 'assistant', content: greeting, timestamp: new Date() }])
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch {
      setStarted(true)
      setMessages([{ id: '1', sender: 'system', content: 'Could not connect. Please try WhatsApp or call us directly.', timestamp: new Date() }])
    } finally {
      setStarting(false)
    }
  }

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || loading || !session) return
    setInput('')
    const userMsg = { id: Date.now().toString(), sender: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await chatApi.sendMessage(session.id, content)
      const assistantText = res.message_text || res.ai_text || 'Thanks for your question. We will get back to you shortly.'
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), sender: 'assistant', content: assistantText, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), sender: 'system', content: 'Message failed. Check your connection.', timestamp: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 pt-20 flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col">
        <div className="card p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-stone-900 text-sm">Elecon AI Sales Assistant</p>
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Online
            </p>
          </div>
          <div className="flex gap-2">
            <a href="tel:+254700000000" className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Phone className="w-4 h-4" /></a>
            <a href="https://wa.me/254700000000" target="_blank" rel="noopener" className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"><MessageCircle className="w-4 h-4" /></a>
          </div>
        </div>

        {!started ? (
          <div className="card p-8 flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-amber-700" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-stone-900 mb-2">Start your conversation</h2>
              <p className="text-stone-500 max-w-sm">Get instant stock checks, prices, and quotes.{productHint && ' Enquiring about: ' + productHint}</p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <div><label className="label">Your name (optional)</label><input className="input" placeholder="e.g. James Kamau" value={name} onChange={e => setName(e.target.value)} /></div>
              <div><label className="label">Phone number (optional)</label><input className="input" placeholder="+254 7XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <button onClick={startChat} disabled={starting} className="btn-primary w-full justify-center">
                {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</> : <><MessageCircle className="w-4 h-4" /> Start Chat</>}
              </button>
              <p className="text-xs text-stone-400">No account needed. Your conversation is saved so our team can follow up.</p>
            </div>
            <div className="w-full max-w-sm pt-4 border-t border-stone-200">
              <p className="text-xs text-stone-400 mb-3">Or reach us directly:</p>
              <div className="flex gap-2">
                <a href="https://wa.me/254700000000" target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">?? WhatsApp</a>
                <a href="tel:+254700000000" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900">?? Call</a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 mb-4 min-h-[400px]">
              {messages.map(msg => (
                <div key={msg.id} className={'flex gap-3 ' + (msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  {msg.sender !== 'system' && (
                    <div className={'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ' + (msg.sender === 'user' ? 'bg-stone-300' : 'bg-amber-700')}>
                      {msg.sender === 'user' ? <User className="w-4 h-4 text-stone-700" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                  )}
                  <div className={'max-w-xs ' + (msg.sender === 'system' ? 'w-full text-center' : '')}>
                    {msg.sender === 'system' ? (
                      <p className="text-xs text-stone-400 italic py-2">{msg.content}</p>
                    ) : (
                      <div className={'px-4 py-2.5 rounded-2xl text-sm leading-relaxed ' + (msg.sender === 'user' ? 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm' : 'bg-amber-700 text-white rounded-br-sm')}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                    <p className={'text-xs text-stone-400 mt-1 ' + (msg.sender === 'user' ? 'text-right' : '')}>{timeAgo(msg.timestamp)}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                  <div className="bg-amber-700 rounded-2xl rounded-br-sm px-4 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{animationDelay:'0ms'}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{animationDelay:'150ms'}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{animationDelay:'300ms'}} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {messages.length <= 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendMessage(p)} className="flex-shrink-0 text-xs px-3 py-2 bg-white border border-stone-200 rounded-full text-stone-600 hover:border-amber-400 hover:text-amber-700 transition-colors whitespace-nowrap">{p}</button>
                ))}
              </div>
            )}
            <div className="card p-2 flex gap-2">
              <input ref={inputRef} className="flex-1 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-transparent focus:outline-none"
                placeholder="Ask about stock, prices, or delivery..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                disabled={loading} />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-700 text-white flex items-center justify-center hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-center text-xs text-stone-400 mt-2">AI responses are based on live stock data. A human can take over anytime.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-700" /></div>}>
        <ChatContent />
      </Suspense>
    </>
  )
}

