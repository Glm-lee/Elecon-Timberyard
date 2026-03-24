'use client'
import { useEffect, useState } from 'react'
import { ordersApi } from '@/lib/api'
import { formatCurrency, formatDateTime, getOrderStatusColor } from '@/lib/utils'
import { ShoppingCart, Search, ChevronDown, ChevronUp } from 'lucide-react'

const STATUSES = ['all','pending','confirmed','processing','delivered','cancelled']

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<number|null>(null)
  const [updatingId, setUpdatingId] = useState<number|null>(null)

  useEffect(() => { ordersApi.list({ limit: 200 }).then(setOrders).catch(() => {}).finally(() => setLoading(false)) }, [])

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id)
    try { const updated = await ordersApi.updateStatus(id, status); setOrders(prev => prev.map((o:any) => o.id === id ? updated : o)) }
    catch {} finally { setUpdatingId(null) }
  }

  const filtered = orders.filter((o:any) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !search || String(o.id).includes(q) || o.customer?.name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-bold text-stone-900">Orders</h2>
        <p className="text-stone-500 text-sm">{filtered.length} orders · Revenue: <span className="font-semibold text-green-700">{formatCurrency(filtered.filter((o:any) => o.status !== 'cancelled').reduce((s:number,o:any) => s + o.total_amount, 0))}</span></p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><input className="input pl-9" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUSES.map(s => <button key={s} onClick={() => setStatusFilter(s)} className={'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ' + (statusFilter === s ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}>{s}</button>)}
        </div>
      </div>
      <div className="space-y-3">
        {loading ? [...Array(4)].map((_,i) => <div key={i} className="card p-4 animate-pulse"><div className="h-5 bg-stone-200 rounded w-48" /></div>)
        : filtered.length === 0 ? <div className="card p-12 text-center"><ShoppingCart className="w-10 h-10 text-stone-300 mx-auto mb-3" /><p className="text-stone-400">No orders found</p></div>
        : filtered.map((order:any) => (
          <div key={order.id} className="card overflow-hidden">
            <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-stone-50 transition-colors" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-stone-900 text-sm">Order #{order.id}</span>
                  <span className={'badge ' + getOrderStatusColor(order.status)}>{order.status}</span>
                  <span className="text-xs text-stone-400 capitalize">{order.source_channel}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{order.customer?.name || 'Unknown'} · {formatDateTime(order.created_at)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-serif font-bold text-stone-900">{formatCurrency(order.total_amount)}</p>
              </div>
              {expandedId === order.id ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />}
            </div>
            {expandedId === order.id && (
              <div className="border-t border-stone-100 bg-stone-50 p-4 space-y-4">
                {order.delivery_location && <p className="text-sm text-stone-600"><span className="font-medium">Delivery: </span>{order.delivery_location}</p>}
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {['pending','confirmed','processing','delivered','cancelled'].map(s => (
                      <button key={s} onClick={() => updateStatus(order.id, s)} disabled={order.status === s || updatingId === order.id}
                        className={'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all disabled:opacity-40 disabled:cursor-not-allowed ' + (order.status === s ? 'bg-stone-200 text-stone-500' : 'bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:text-amber-700')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

