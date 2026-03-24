'use client'
import { useEffect, useState } from 'react'
import { productsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, X, Loader2, Check } from 'lucide-react'

function Modal({ product, onClose, onSave }: any) {
  const [form, setForm] = useState({ name: product?.name||'', wood_type: product?.wood_type||'', size: product?.size||'', price: product?.price||0, stock_quantity: product?.stock_quantity||0, description: product?.description||'' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try { if (product) { await productsApi.update(product.id, form) } else { await productsApi.create(form) }; onSave(); onClose() }
    catch (err: any) { setError(err?.response?.data?.detail || 'Failed to save') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <h2 className="font-serif font-semibold text-xl text-stone-900">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Product Name *</label><input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. 2x4 Pine Timber" /></div>
            <div><label className="label">Timber Type *</label>
              <select className="input" required value={form.wood_type} onChange={e => setForm({...form, wood_type: e.target.value})}>
                <option value="">Select type</option>
                {['Softwood','Hardwood','Structural','Treated','Plywood','Engineered'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Size *</label><input className="input" required value={form.size} onChange={e => setForm({...form, size: e.target.value})} placeholder="e.g. 2x4 inch" /></div>
            <div><label className="label">Price (KES) *</label><input className="input" type="number" required min={0} value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} /></div>
            <div><label className="label">Stock Quantity *</label><input className="input" type="number" required min={0} value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="label">Description</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief product description..." /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<any>(undefined)
  const [deleting, setDeleting] = useState<number|null>(null)

  const load = () => { setLoading(true); productsApi.list({ limit: 200 }).then(d => { setProducts(d); setFiltered(d) }).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!search) { setFiltered(products); return }
    const q = search.toLowerCase()
    setFiltered(products.filter((p:any) => p.name?.toLowerCase().includes(q) || p.wood_type?.toLowerCase().includes(q) || p.size?.toLowerCase().includes(q)))
  }, [search, products])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return
    setDeleting(id)
    try { await productsApi.delete(id); setProducts(prev => prev.filter((p:any) => p.id !== id)) }
    catch {} finally { setDeleting(null) }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h2 className="font-serif text-2xl font-bold text-stone-900">Products</h2><p className="text-stone-500 text-sm mt-0.5">{products.length} products in catalogue</p></div>
        <button onClick={() => setModal(null)} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>
      </div>
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input className="input pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>{['Product','Type','Size','Price','Stock',''].map(h => <th key={h} className={'text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider' + (h==='' ? '' : '')}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? [...Array(5)].map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {[...Array(6)].map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-stone-200 rounded w-20" /></td>)}
                </tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><Package className="w-8 h-8 text-stone-300 mx-auto mb-2" /><p className="text-sm text-stone-400">No products found</p></td></tr>
              ) : filtered.map((p:any) => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-stone-900">{p.name}</p>{p.description && <p className="text-xs text-stone-400 truncate max-w-[200px]">{p.description}</p>}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">{p.wood_type}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-mono text-stone-700">{p.size}</span></td>
                  <td className="px-4 py-3 text-right"><p className="text-sm font-semibold text-stone-900">{formatCurrency(p.price)}</p></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.stock_quantity < 50 && p.stock_quantity > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                      <span className={'text-sm font-medium ' + (p.stock_quantity === 0 ? 'text-red-600' : p.stock_quantity < 50 ? 'text-amber-600' : 'text-green-700')}>{p.stock_quantity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModal(p)} className="p-1.5 rounded-lg text-stone-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
                        {deleting === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== undefined && <Modal product={modal || undefined} onClose={() => setModal(undefined)} onSave={load} />}
    </div>
  )
}

