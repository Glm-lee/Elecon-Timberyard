'use client'
import { useEffect, useState } from 'react'
import { leadsApi } from '@/lib/api'
import { formatDateTime, getLeadStatusColor, getChannelIcon } from '@/lib/utils'
import { Users, Search, Flame, TrendingUp, Snowflake, CheckCircle } from 'lucide-react'

const STATUS_OPTIONS = ['all','hot','warm','cold','converted','lost','new']

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<number|null>(null)

  useEffect(() => { leadsApi.list({ limit: 200 }).then(setLeads).catch(() => {}).finally(() => setLoading(false)) }, [])

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id)
    try { const updated = await leadsApi.update(id, { status }); setLeads(prev => prev.map((l:any) => l.id === id ? updated : l)) }
    catch {} finally { setUpdatingId(null) }
  }

  const filtered = leads.filter((l:any) => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !search || l.customer?.name?.toLowerCase().includes(q) || l.source_channel?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = { hot: leads.filter((l:any) => l.status==='hot').length, warm: leads.filter((l:any) => l.status==='warm').length, cold: leads.filter((l:any) => l.status==='cold').length, converted: leads.filter((l:any) => l.status==='converted').length }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="font-serif text-2xl font-bold text-stone-900 mb-5">Leads</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[{label:'Hot',count:counts.hot,color:'bg-red-100 text-red-600',icon:Flame},{label:'Warm',count:counts.warm,color:'bg-amber-100 text-amber-600',icon:TrendingUp},{label:'Cold',count:counts.cold,color:'bg-blue-100 text-blue-600',icon:Snowflake},{label:'Converted',count:counts.converted,color:'bg-green-100 text-green-600',icon:CheckCircle}].map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="card p-4 flex items-center gap-3">
              <div className={'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' + item.color}><Icon className="w-4 h-4" /></div>
              <div><p className="font-serif font-bold text-xl text-stone-950">{item.count}</p><p className="text-xs text-stone-500">{item.label} leads</p></div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><input className="input pl-9" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(s => <button key={s} onClick={() => setStatusFilter(s)} className={'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ' + (statusFilter === s ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}>{s}</button>)}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>{['Contact','Source','Status','Date','Update'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? [...Array(5)].map((_,i) => <tr key={i} className="animate-pulse">{[...Array(5)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-stone-200 rounded w-24" /></td>)}</tr>)
              : filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center"><Users className="w-8 h-8 text-stone-300 mx-auto mb-2" /><p className="text-sm text-stone-400">No leads found</p></td></tr>
              : filtered.map((lead:any) => (
                <tr key={lead.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-stone-900">{lead.customer?.name || 'Lead #' + lead.id}</p>{lead.customer?.phone && <p className="text-xs text-stone-400">{lead.customer.phone}</p>}</td>
                  <td className="px-4 py-3"><span className="text-sm text-stone-600 flex items-center gap-1.5"><span>{getChannelIcon(lead.source_channel)}</span><span className="capitalize">{lead.source_channel}</span></span></td>
                  <td className="px-4 py-3"><span className={'badge ' + getLeadStatusColor(lead.status)}>{lead.status}</span></td>
                  <td className="px-4 py-3"><p className="text-xs text-stone-500">{formatDateTime(lead.captured_at)}</p></td>
                  <td className="px-4 py-3">
                    <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)} disabled={updatingId === lead.id}
                      className="text-xs border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-700 focus:outline-none focus:border-amber-400 disabled:opacity-40">
                      {['hot','warm','cold','converted','lost','new'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

