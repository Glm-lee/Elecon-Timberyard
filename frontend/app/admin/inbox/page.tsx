'use client'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { sessionsApi } from '@/lib/api'
import { timeAgo, getChannelIcon } from '@/lib/utils'
import {
  Bot,
  User,
  Shield,
  Send,
  Loader2,
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock3,
  Lock,
} from 'lucide-react'

type SessionStatus = 'all' | 'active' | 'pending_human' | 'closed'

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

function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 border-green-200 text-green-700',
    pending_human: 'bg-amber-100 border-amber-200 text-amber-700',
    closed: 'bg-stone-200 border-stone-300 text-stone-700',
  }
  return map[status] || 'bg-stone-100 border-stone-200 text-stone-700'
}

function InboxContent() {
  const searchParams = useSearchParams()
  const querySession = searchParams.get('session')
  const queryStatus = (searchParams.get('status') || 'all') as SessionStatus

  const [sessions, setSessions] = useState<any[]>([])
  const [activeId, setActiveId] = useState<number | null>(querySession ? Number(querySession) : null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SessionStatus>(['all', 'active', 'pending_human', 'closed'].includes(queryStatus) ? queryStatus : 'all')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadSessions = () => {
    setLoadingSessions(true)
    sessionsApi.list({ status: statusFilter, page: 1, page_size: 60 })
      .then((d) => setSessions(ensureArray(d)))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }

  useEffect(() => {
    loadSessions()
  }, [statusFilter])

  useEffect(() => {
    if (!activeId) return
    sessionsApi.getMessages(activeId).then((msgs) => {
      const arr = ensureArray(msgs)
      const mapped = arr.map((m: any) => ({ ...m, content: m.message_text || m.content || '' }))
      setMessages(mapped)
    }).catch(() => {})
    sessionsApi.markRead(activeId).catch(() => {})
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendReply = async () => {
    if (!reply.trim() || !activeId || loading) return
    setLoading(true)
    const content = reply
    setReply('')
    try {
      const msg = await sessionsApi.sendMessage(activeId, content)
      setMessages((prev) => [...prev, { ...msg, content: msg.message_text || msg.content || content }])
      setSessions((prev) => prev.map((session) => getSessionId(session) === activeId ? { ...session, status: 'active', last_activity: new Date().toISOString() } : session))
    } catch {
      setReply(content)
    } finally {
      setLoading(false)
    }
  }

  const updateSessionStatus = async (status: 'active' | 'pending_human' | 'closed') => {
    if (!activeId || updatingStatus) return
    setUpdatingStatus(true)
    try {
      await sessionsApi.updateStatus(activeId, status)
      setSessions((prev) => prev.map((session) => getSessionId(session) === activeId ? { ...session, status } : session))
    } catch {
      alert('Could not update session status right now.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter((session: any) => {
      const name = session.customer?.name || session.customer_name || ''
      const channel = session.channel || ''
      const preview = session.last_message || ''
      return name.toLowerCase().includes(q) || channel.toLowerCase().includes(q) || preview.toLowerCase().includes(q)
    })
  }, [search, sessions])

  const activeSession = sessions.find((session: any, idx: number) => getSessionId(session, idx) === activeId)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-84 flex-shrink-0 border-r border-stone-200 bg-white flex flex-col">
        <div className="p-4 border-b border-stone-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input className="input py-2 pl-9 text-sm" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {([
              { key: 'all', label: 'All' },
              { key: 'pending_human', label: 'Need Human' },
              { key: 'active', label: 'Active' },
              { key: 'closed', label: 'Closed' },
            ] as { key: SessionStatus; label: string }[]).map((status) => (
              <button
                key={status.key}
                type="button"
                onClick={() => setStatusFilter(status.key)}
                className={'px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ' + (statusFilter === status.key ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loadingSessions ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center"><MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" /><p className="text-sm text-stone-400">No conversations found</p></div>
          ) : filtered.map((session: any, idx: number) => {
            const sid = getSessionId(session, idx)
            return (
              <button
                key={`session-${sid}`}
                type="button"
                onClick={() => setActiveId(sid)}
                className={'w-full text-left px-4 py-3.5 border-b border-stone-100 hover:bg-stone-50 transition-colors ' + (sid === activeId ? 'bg-amber-50 border-l-2 border-l-amber-700' : '')}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-base flex-shrink-0">{getChannelIcon(session.channel)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-stone-900 truncate">{session.customer?.name || session.customer_name || 'Customer #' + sid}</p>
                      <span className="text-xs text-stone-400 flex-shrink-0">{timeAgo(session.last_activity || session.created_at)}</span>
                    </div>
                    <p className="text-xs text-stone-500 capitalize truncate">{session.channel} channel</p>
                    <p className="text-xs text-stone-500 truncate mt-0.5">{session.last_message || 'No recent message.'}</p>
                    <span className={'mt-1 inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ' + getStatusBadgeClass(session.status || 'active')}>
                      {(session.status || 'active').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t border-stone-200">
          <button type="button" onClick={loadSessions} className="btn-ghost w-full justify-center text-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </div>

      {activeId && activeSession ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white border-b border-stone-200 px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getChannelIcon(activeSession.channel)}</div>
                <div>
                  <p className="font-semibold text-stone-900">{activeSession.customer?.name || activeSession.customer_name || 'Customer #' + activeId}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-stone-500 capitalize">{activeSession.channel}</p>
                    <span className={'inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ' + getStatusBadgeClass(activeSession.status || 'active')}>
                      {(activeSession.status || 'active').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateSessionStatus('active')}
                  disabled={updatingStatus || activeSession.status === 'active'}
                  className="btn-ghost text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Active
                </button>
                <button
                  type="button"
                  onClick={() => updateSessionStatus('pending_human')}
                  disabled={updatingStatus || activeSession.status === 'pending_human'}
                  className="btn-ghost text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  <Clock3 className="w-4 h-4" />
                  Needs Human
                </button>
                <button
                  type="button"
                  onClick={() => updateSessionStatus('closed')}
                  disabled={updatingStatus || activeSession.status === 'closed'}
                  className="btn-ghost text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  Close
                </button>
              </div>
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
                  <div className={'max-w-xs md:max-w-md ' + (!isCustomer ? 'items-end flex flex-col' : '')}>
                    <div className={'px-4 py-2.5 rounded-2xl text-sm leading-relaxed ' + (isCustomer ? 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm' : isAdmin ? 'bg-green-700 text-white rounded-br-sm' : 'bg-amber-700 text-white rounded-br-sm')}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className={'text-xs text-stone-400 mt-1 ' + (!isCustomer ? 'text-right' : '')}>{isCustomer ? 'Customer' : isAdmin ? 'Admin' : 'AI'} | {timeAgo(msg.timestamp || msg.created_at)}</p>
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
              <textarea
                className="flex-1 input resize-none text-sm"
                rows={2}
                placeholder={activeSession.status === 'pending_human' ? 'Reply as human sales agent...' : 'Type your reply... (Enter to send)'}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={!reply.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-700 text-white flex items-center justify-center hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-stone-50">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="font-serif text-lg text-stone-600 mb-1">Select a conversation</p>
            <p className="text-sm text-stone-400">Choose a session from the left to reply.</p>
          </div>
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
