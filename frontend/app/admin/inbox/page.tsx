'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { sessionsApi } from '@/lib/api'
import { timeAgo, getChannelIcon } from '@/lib/utils'
import { Bot, User, Shield, Send, Loader2, MessageSquare, Search, RefreshCw } from 'lucide-react'

function ensureArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  if (data && Array.isArray(data.sessions)) return data.sessions
  if (data && Array.isArray(data.messages)) return data.messages
  return []
}

function getSessionId(session: any, idx = 0): number {
  return Number(session?.id ?? session?.session_id ?? idx)
}

function getMessageId(message: any, idx = 0): string {
  return String(message?.id ?? `${message?.sender || 'msg'}-${message?.timestamp || message?.created_at || idx}`)
}

function InboxContent() {
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<any[]>([])
  const [activeId, setActiveId] = useState<number | null>(searchParams.get('session') ? parseInt(searchParams.get('session')!) : null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadSessions = () => {
    setLoadingSessions(true)
    sessionsApi.list({ limit: 50 })
      .then(d => setSessions(ensureArray(d)))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }

  useEffect(() => { loadSessions() }, [])

  useEffect(() => {
    if (!activeId) return
    sessionsApi.getMessages(activeId).then(msgs => {
      const arr = ensureArray(msgs)
      const mapped = arr.map((m: any) => ({ ...m, content: m.message_text || m.content || '' }))
      setMessages(mapped)
    }).catch(() => {})
    sessionsApi.markRead(activeId).catch(() => {})
  }, [activeId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendReply = async () => {
    if (!reply.trim() || !activeId || loading) return
    setLoading(true)
    const content = reply
    setReply('')
    try {
      const msg = await sessionsApi.sendMessage(activeId, content)
      setMessages(prev => [...prev, { ...msg, content: msg.message_text || msg.content || content }])
    } catch { setReply(content) }
    finally { setLoading(false) }
  }

  const filtered = sessions.filter((s: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.customer?.name?.toLowerCase().includes(q) || s.channel?.toLowerCase().includes(q)
  })

  const activeSession = sessions.find((s: any, idx: number) => getSessionId(s, idx) === activeId)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 flex-shrink-0 border-r border-stone-200 bg-white flex flex-col">
        <div className="p-4 border-b border-stone-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input className="input py-2 pl-9 text-sm" placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loadingSessions ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center"><MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" /><p className="text-sm text-stone-400">No conversations yet</p></div>
          ) : filtered.map((s: any, idx: number) => {
            const sid = getSessionId(s, idx)
            return (
            <button key={`session-${sid}`} onClick={() => setActiveId(sid)}
              className={'w-full text-left px-4 py-3.5 border-b border-stone-100 hover:bg-stone-50 transition-colors ' + (sid === activeId ? 'bg-amber-50 border-l-2 border-l-amber-700' : '')}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-base flex-shrink-0">{getChannelIcon(s.channel)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-stone-900 truncate">{s.customer?.name || s.customer_name || 'Customer #' + sid}</p>
                    <span className="text-xs text-stone-400 flex-shrink-0">{timeAgo(s.created_at)}</span>
                  </div>
                  <p className="text-xs text-stone-500 capitalize truncate">{s.channel} - {s.status}</p>
                </div>
              </div>
            </button>
          )})}
        </div>
        <div className="p-3 border-t border-stone-200">
          <button onClick={loadSessions} className="btn-ghost w-full justify-center text-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </div>

      {activeId && activeSession ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center gap-4">
            <div className="text-2xl">{getChannelIcon(activeSession.channel)}</div>
            <div>
              <p className="font-semibold text-stone-900">{activeSession.customer?.name || 'Customer #' + activeSession.id}</p>
              <p className="text-xs text-stone-500 capitalize">{activeSession.channel} - {activeSession.status}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6 bg-stone-50 space-y-4">
            {messages.map((msg: any, idx: number) => {
              const isCustomer = msg.sender === 'customer'
              const isAdmin = msg.sender === 'admin'
              return (
                <div key={getMessageId(msg, idx)} className={'flex gap-2.5 ' + (isCustomer ? 'flex-row' : 'flex-row-reverse')}>
                  <div className={'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ' + (isCustomer ? 'bg-stone-200' : isAdmin ? 'bg-green-700' : 'bg-amber-700')}>
                    {isCustomer ? <User className="w-3.5 h-3.5 text-stone-600" /> : isAdmin ? <Shield className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className={'max-w-xs ' + (!isCustomer ? 'items-end flex flex-col' : '')}>
                    <div className={'px-4 py-2.5 rounded-2xl text-sm leading-relaxed ' + (isCustomer ? 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm' : isAdmin ? 'bg-green-700 text-white rounded-br-sm' : 'bg-amber-700 text-white rounded-br-sm')}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className={'text-xs text-stone-400 mt-1 ' + (!isCustomer ? 'text-right' : '')}>{isCustomer ? 'Customer' : isAdmin ? 'Admin' : 'AI'} - {timeAgo(msg.timestamp || msg.created_at)}</p>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-green-700 rounded-2xl rounded-br-sm px-4 py-3 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span className="text-xs text-white">Sending...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="bg-white border-t border-stone-200 p-4">
            <div className="flex gap-3 items-end">
              <textarea className="flex-1 input resize-none text-sm" rows={2} placeholder="Type your reply... (Enter to send)"
                value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }} />
              <button onClick={sendReply} disabled={!reply.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-700 text-white flex items-center justify-center hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-stone-50">
          <div className="text-center"><MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" /><p className="font-serif text-lg text-stone-600 mb-1">Select a conversation</p><p className="text-sm text-stone-400">Choose from the list on the left</p></div>
        </div>
      )}
    </div>
  )
}

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-amber-700" /></div>}>
      <InboxContent />
    </Suspense>
  )
}
