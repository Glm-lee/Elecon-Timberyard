'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { dashboardApi, sessionsApi, leadsApi, ordersApi } from '@/lib/api'
import { formatCurrency, timeAgo, getLeadStatusColor, getChannelIcon, getOrderStatusColor } from '@/lib/utils'
import { MessageSquare, Users, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight, Activity } from 'lucide-react'

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

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>({ active_sessions:0, hot_leads:0, total_leads:0, pending_orders:0, total_revenue:0, low_stock_products:0 })
  const [sessions, setSessions] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(() => {})
    sessionsApi.list({ limit: 5 }).then(d => setSessions(ensureArray(d))).catch(() => {})
    leadsApi.list({ limit: 5 }).then(d => setLeads(ensureArray(d))).catch(() => {})
    ordersApi.list({ limit: 5 }).then(d => setOrders(ensureArray(d))).catch(() => {})
  }, [])

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div><h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">Good morning!</h2><p className="text-stone-500 text-sm">Here is what is happening at Elecon today.</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Active Chats" value={stats.active_sessions || 0} sub="live conversations" icon={MessageSquare} color="bg-blue-100 text-blue-700" href="/admin/inbox" />
        <StatCard label="Hot Leads" value={stats.hot_leads || 0} sub={'of ' + (stats.total_leads || 0) + ' total'} icon={TrendingUp} color="bg-red-100 text-red-600" href="/admin/leads" />
        <StatCard label="Pending Orders" value={stats.pending_orders || 0} sub="need attention" icon={ShoppingCart} color="bg-amber-100 text-amber-700" href="/admin/orders" />
        <StatCard label="Revenue" value={formatCurrency(stats.total_revenue || 0)} sub="this month" icon={Activity} color="bg-green-100 text-green-700" />
        <StatCard label="Total Leads" value={stats.total_leads || 0} sub="all time" icon={Users} color="bg-purple-100 text-purple-700" href="/admin/leads" />
        <StatCard label="Low Stock" value={stats.low_stock_products || 0} sub="products" icon={AlertTriangle} color="bg-orange-100 text-orange-700" href="/admin/products" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-amber-700" /> Recent Conversations</h3>
            <Link href="/admin/inbox" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {sessions.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No conversations yet</p> : sessions.map((s:any, idx:number) => {
              const sessionId = s.id ?? s.session_id ?? idx
              return (
              <Link key={`session-${sessionId}`} href={'/admin/inbox?session=' + sessionId} className="flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm flex-shrink-0">{getChannelIcon(s.channel)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{s.customer?.name || s.customer_name || 'Customer #' + sessionId}</p>
                  <p className="text-xs text-stone-400 truncate">{s.channel} channel</p>
                </div>
                <p className="text-xs text-stone-400 flex-shrink-0">{timeAgo(s.created_at)}</p>
              </Link>
            )})}
          </div>
        </div>
        <div className="card">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><Users className="w-4 h-4 text-amber-700" /> Recent Leads</h3>
            <Link href="/admin/leads" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {leads.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No leads yet</p> : leads.map((lead:any, idx:number) => {
              const leadId = lead.id ?? idx
              return (
              <div key={`lead-${leadId}`} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{lead.customer?.name || 'Lead #' + leadId}</p>
                  <p className="text-xs text-stone-400 capitalize">{lead.source_channel} · {timeAgo(lead.captured_at)}</p>
                </div>
                <span className={'badge ' + getLeadStatusColor(lead.status)}>{lead.status}</span>
              </div>
            )})}
          </div>
        </div>
        <div className="card xl:col-span-2">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-700" /> Recent Orders</h3>
            <Link href="/admin/orders" className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-stone-50">
            {orders.length === 0 ? <p className="p-6 text-sm text-stone-400 text-center">No orders yet</p> : orders.map((order:any, idx:number) => {
              const orderId = order.id ?? idx
              return (
              <div key={`order-${orderId}`} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">Order #{orderId}</p>
                  <p className="text-xs text-stone-400">{order.customer?.name || 'Unknown'} · {timeAgo(order.created_at)}</p>
                </div>
                <p className="text-sm font-semibold text-stone-900">{formatCurrency(order.total_amount)}</p>
                <span className={'badge text-xs ' + getOrderStatusColor(order.status)}>{order.status}</span>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
