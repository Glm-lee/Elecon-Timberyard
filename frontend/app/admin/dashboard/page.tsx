'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { dashboardApi, sessionsApi, leadsApi, ordersApi } from '@/lib/api'
import { formatCurrency, timeAgo, getLeadStatusColor, getChannelIcon, getOrderStatusColor } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'

type RevenuePeriod = 'day' | 'week' | 'month'

function StatCard({ label, value, sub, icon: Icon, color, href }: any) {
  const content = (
    <div className={'card p-6 transition-all ' + (href ? 'hover:shadow-md cursor-pointer' : '')}>
      <div className="flex items-start justify-between mb-4">
        <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + color}><Icon className="w-5 h-5" /></div>
        {href && <ArrowRight className="w-4 h-4 text-stone-400" />}
      </div>
      <p className="font-serif text-3xl font-bold text-stone-950 mb-1">{value}</p>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function ensureArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  if (data && Array.isArray(data.sessions)) return data.sessions
  if (data && Array.isArray(data.leads)) return data.leads
  if (data && Array.isArray(data.orders)) return data.orders
  return []
}

function maxRevenue(points: any[]): number {
  if (!points.length) return 1
  return Math.max(...points.map((point) => Number(point.revenue || 0)), 1)
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>({
    active_sessions: 0,
    pending_human_sessions: 0,
    hot_leads: 0,
    total_leads: 0,
    pending_orders: 0,
    total_revenue: 0,
    revenue_today: 0,
    revenue_this_week: 0,
    revenue_this_month: 0,
    low_stock_products: 0,
    out_of_stock_products: 0,
  })
  const [sessions, setSessions] = useState<any[]>([])
  const [handoffSessions, setHandoffSessions] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('month')
  const [revenueSeries, setRevenueSeries] = useState<any[]>([])

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => {})
    sessionsApi.list({ status: 'all', page: 1, page_size: 6 }).then((d) => setSessions(ensureArray(d))).catch(() => {})
    sessionsApi.list({ status: 'pending_human', page: 1, page_size: 6 }).then((d) => setHandoffSessions(ensureArray(d))).catch(() => {})
    leadsApi.list({ limit: 5 }).then((d) => setLeads(ensureArray(d))).catch(() => {})
    ordersApi.list({ limit: 5 }).then((d) => setOrders(ensureArray(d))).catch(() => {})
  }, [])

  useEffect(() => {
    dashboardApi.revenueBreakdown(revenuePeriod)
      .then((rows) => setRevenueSeries(Array.isArray(rows) ? rows : []))
      .catch(() => setRevenueSeries([]))
  }, [revenuePeriod])

  const revenueTotal = useMemo(() => revenueSeries.reduce((sum, point) => sum + Number(point.revenue || 0), 0), [revenueSeries])
  const maxPointRevenue = useMemo(() => maxRevenue(revenueSeries), [revenueSeries])
  const bestPoint = useMemo(() => {
    if (!revenueSeries.length) return null
    return revenueSeries.reduce((best, current) => (Number(current.revenue || 0) > Number(best.revenue || 0) ? current : best), revenueSeries[0])
  }, [revenueSeries])

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">Growth Dashboard</h2>
          <p className="text-stone-500 text-sm">Track leads, handoff chats, stock alerts, and live sales performance in one view.</p>
        </div>
        <div className="card px-4 py-3 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-800">Today&apos;s Revenue</p>
          <p className="font-serif text-xl text-amber-900 font-bold">{formatCurrency(stats.revenue_today || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Active Chats" value={stats.active_sessions || 0} sub="live conversations" icon={MessageSquare} color="bg-blue-100 text-blue-700" href="/admin/inbox" />
        <StatCard label="Needs Human" value={stats.pending_human_sessions || 0} sub="handoff queue" icon={Bot} color="bg-amber-100 text-amber-700" href="/admin/inbox?status=pending_human" />
        <StatCard label="Pending Orders" value={stats.pending_orders || 0} sub="awaiting action" icon={ShoppingCart} color="bg-orange-100 text-orange-700" href="/admin/orders" />
        <StatCard label="Revenue This Week" value={formatCurrency(stats.revenue_this_week || 0)} sub="rolling 7 days" icon={Activity} color="bg-green-100 text-green-700" />
        <StatCard label="Hot Leads" value={stats.hot_leads || 0} sub={'of ' + (stats.total_leads || 0) + ' total'} icon={TrendingUp} color="bg-red-100 text-red-600" href="/admin/leads" />
        <StatCard label="Low/Out Stock" value={(stats.low_stock_products || 0) + (stats.out_of_stock_products || 0)} sub="products to replenish" icon={AlertTriangle} color="bg-yellow-100 text-yellow-700" href="/admin/products" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-700" />
                Revenue Breakdown
              </h3>
              <p className="text-xs text-stone-500 mt-1">Expand by day, week, or month to spot momentum trends.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-100 rounded-full p-1">
              {(['day', 'week', 'month'] as RevenuePeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setRevenuePeriod(period)}
                  className={'px-3 py-1.5 text-xs rounded-full capitalize transition-colors ' + (revenuePeriod === period ? 'bg-amber-700 text-white' : 'text-stone-600 hover:bg-stone-200')}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wider">Visible total</p>
                <p className="font-serif text-3xl font-bold text-stone-900">{formatCurrency(revenueTotal)}</p>
              </div>
              <div className="text-xs text-stone-500">
                {bestPoint ? (
                  <p>Best {revenuePeriod}: <span className="font-semibold text-stone-700">{bestPoint.label}</span> ({formatCurrency(Number(bestPoint.revenue || 0))})</p>
                ) : (
                  <p>No revenue points for this range yet.</p>
                )}
              </div>
            </div>

            {revenueSeries.length === 0 ? (
              <div className="h-56 rounded-xl bg-stone-50 border border-dashed border-stone-300 flex items-center justify-center">
                <p className="text-sm text-stone-500">No revenue data yet for this selection.</p>
              </div>
            ) : (
              <div className="h-56 rounded-xl bg-stone-50 border border-stone-200 px-3 py-4">
                <div className="h-full flex items-end gap-2 overflow-x-auto">
                  {revenueSeries.map((point) => {
                    const height = `${Math.max((Number(point.revenue || 0) / maxPointRevenue) * 100, 5)}%`
                    return (
                      <div key={point.label} className="w-11 flex-shrink-0 flex flex-col items-center justify-end gap-1">
                        <div
                          title={`${point.label}: ${formatCurrency(Number(point.revenue || 0))}`}
                          className="w-full rounded-t-md bg-gradient-to-t from-amber-700 to-amber-400 hover:from-amber-800 hover:to-amber-500 transition-colors"
                          style={{ height }}
                        />
                        <p className="text-[10px] text-stone-500 text-center leading-tight line-clamp-2">{point.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-700" />
              Human Handoff Queue
            </h3>
            <Link href="/admin/inbox?status=pending_human" className="text-xs text-amber-700 hover:text-amber-800 font-medium">Open Inbox</Link>
          </div>
          <div className="divide-y divide-stone-100">
            {handoffSessions.length === 0 ? (
              <p className="p-6 text-sm text-stone-500 text-center">No chats waiting for a human right now.</p>
            ) : handoffSessions.map((session: any, idx: number) => {
              const sid = Number(session.session_id ?? session.id ?? idx)
              return (
                <Link key={`handoff-${sid}`} href={`/admin/inbox?status=pending_human&session=${sid}`} className="block p-4 hover:bg-stone-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-stone-900 truncate">{session.customer_name || `Customer #${sid}`}</p>
                    <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Needs human</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 truncate">{session.last_message || 'No latest message.'}</p>
                  <p className="text-xs text-stone-400 mt-1">{timeAgo(session.last_activity || session.created_at)}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-amber-700" /> Recent Conversations</h3>
            <Link href="/admin/inbox" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {sessions.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No conversations yet</p> : sessions.map((s: any, idx: number) => {
              const sessionId = Number(s.id ?? s.session_id ?? idx)
              return (
                <Link key={`session-${sessionId}`} href={'/admin/inbox?session=' + sessionId} className="flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm flex-shrink-0">{getChannelIcon(s.channel)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{s.customer?.name || s.customer_name || 'Customer #' + sessionId}</p>
                    <p className="text-xs text-stone-400 truncate capitalize">{s.channel} channel - {s.status}</p>
                  </div>
                  <p className="text-xs text-stone-400 flex-shrink-0">{timeAgo(s.created_at || s.last_activity)}</p>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><Users className="w-4 h-4 text-amber-700" /> Recent Leads</h3>
            <Link href="/admin/leads" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {leads.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No leads yet</p> : leads.map((lead: any, idx: number) => {
              const leadId = lead.id ?? idx
              return (
                <div key={`lead-${leadId}`} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{lead.customer?.name || 'Lead #' + leadId}</p>
                    <p className="text-xs text-stone-400 capitalize">{lead.source_channel || 'unknown'} | {timeAgo(lead.captured_at)}</p>
                  </div>
                  <span className={'badge ' + getLeadStatusColor(lead.status)}>{lead.status}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card xl:col-span-2">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-700" /> Recent Orders</h3>
            <Link href="/admin/orders" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {orders.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No orders yet</p> : orders.map((order: any, idx: number) => {
              const orderId = order.id ?? idx
              return (
                <div key={`order-${orderId}`} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">Order #{orderId}</p>
                    <p className="text-xs text-stone-400">{order.customer?.name || 'Unknown'} | {timeAgo(order.created_at)}</p>
                  </div>
                  <p className="text-sm font-semibold text-stone-900">{formatCurrency(Number(order.total_amount || 0))}</p>
                  <span className={'badge text-xs ' + getOrderStatusColor(order.status)}>{order.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
