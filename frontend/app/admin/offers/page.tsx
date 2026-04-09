'use client'
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { offersApi, productsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Calendar, Loader2, Percent, Plus, Tag, Trash2 } from 'lucide-react'

type Product = {
  id: number
  name: string
  size?: string
  price: number
  stock_quantity: number
}

type OfferItem = {
  id: number
  offer_id: number
  product_id: number
  offer_price: number
  old_price: number | null
  is_active: boolean
  product_name?: string | null
  product_size?: string | null
  stock_quantity?: number | null
  regular_price?: number | null
}

type Offer = {
  id: number
  title: string
  badge?: string | null
  description?: string | null
  terms?: string | null
  starts_at?: string | null
  ends_at?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  items: OfferItem[]
}

type OfferForm = {
  title: string
  badge: string
  description: string
  terms: string
  starts_at: string
  ends_at: string
  is_active: boolean
}

type ItemDraft = {
  product_id: string
  offer_price: string
  old_price: string
}

const EMPTY_FORM: OfferForm = {
  title: '',
  badge: '',
  description: '',
  terms: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  const hours = String(dt.getHours()).padStart(2, '0')
  const minutes = String(dt.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toIsoOrUndefined(value: string): string | undefined {
  if (!value.trim()) return undefined
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return undefined
  return dt.toISOString()
}

function makePayload(form: OfferForm) {
  return {
    title: form.title.trim(),
    badge: form.badge.trim() || undefined,
    description: form.description.trim() || undefined,
    terms: form.terms.trim() || undefined,
    starts_at: toIsoOrUndefined(form.starts_at),
    ends_at: toIsoOrUndefined(form.ends_at),
    is_active: form.is_active,
  }
}

function OfferEditorModal({
  open,
  form,
  setForm,
  saving,
  error,
  onClose,
  onSave,
  editingTitle,
}: {
  open: boolean
  form: OfferForm
  setForm: Dispatch<SetStateAction<OfferForm>>
  saving: boolean
  error: string
  onClose: () => void
  onSave: () => void
  editingTitle: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-stone-900">{editingTitle}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">Close</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          <div>
            <label className="label">Offer Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Badge</label>
              <input className="input" value={form.badge} onChange={(e) => setForm((prev) => ({ ...prev, badge: e.target.value }))} placeholder="e.g. Easter, Bulk, Limited" />
            </div>
            <div className="flex items-center gap-3 pt-8">
              <input
                id="offer-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 accent-amber-700"
              />
              <label htmlFor="offer-active" className="text-sm text-stone-700">Offer active</label>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Terms</label>
            <textarea className="input resize-none" rows={2} value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Starts At</label>
              <input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ends At</label>
              <input type="datetime-local" className="input" value={form.ends_at} onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving || !form.title.trim()} className="btn-primary disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Offer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [savingForm, setSavingForm] = useState(false)
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM)
  const [deletingOfferId, setDeletingOfferId] = useState<number | null>(null)
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemDraft>>({})
  const [savingItemForOffer, setSavingItemForOffer] = useState<number | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null)

  const productById = useMemo(() => {
    const map: Record<number, Product> = {}
    for (const p of products) map[p.id] = p
    return map
  }, [products])

  const setOfferInState = (updatedOffer: Offer) => {
    setOffers((prev) => prev.map((offer) => (offer.id === updatedOffer.id ? updatedOffer : offer)))
  }

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [offerRows, productRows] = await Promise.all([
        offersApi.listAdmin(),
        productsApi.list({ limit: 500 }),
      ])
      setOffers(Array.isArray(offerRows) ? offerRows : [])
      setProducts(Array.isArray(productRows) ? productRows : [])
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load offers right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (offer: Offer) => {
    setEditingId(offer.id)
    setForm({
      title: offer.title || '',
      badge: offer.badge || '',
      description: offer.description || '',
      terms: offer.terms || '',
      starts_at: toLocalInputValue(offer.starts_at),
      ends_at: toLocalInputValue(offer.ends_at),
      is_active: offer.is_active,
    })
    setFormError('')
    setFormOpen(true)
  }

  const saveOffer = async () => {
    if (!form.title.trim()) {
      setFormError('Offer title is required.')
      return
    }
    setSavingForm(true)
    setFormError('')
    try {
      const payload = makePayload(form)
      if (editingId) {
        const updated = await offersApi.updateOffer(editingId, payload)
        setOfferInState(updated as Offer)
      } else {
        const created = await offersApi.createOffer(payload)
        setOffers((prev) => [created as Offer, ...prev])
      }
      setFormOpen(false)
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to save offer.')
    } finally {
      setSavingForm(false)
    }
  }

  const removeOffer = async (offerId: number) => {
    if (!confirm('Delete this offer and all linked offer products?')) return
    setDeletingOfferId(offerId)
    try {
      await offersApi.deleteOffer(offerId)
      setOffers((prev) => prev.filter((offer) => offer.id !== offerId))
    } catch {
      alert('Could not delete this offer right now.')
    } finally {
      setDeletingOfferId(null)
    }
  }

  const setDraft = (offerId: number, updater: (prev: ItemDraft) => ItemDraft) => {
    setItemDrafts((prev) => ({
      ...prev,
      [offerId]: updater(prev[offerId] || { product_id: '', offer_price: '', old_price: '' }),
    }))
  }

  const addOfferItem = async (offer: Offer) => {
    const draft = itemDrafts[offer.id] || { product_id: '', offer_price: '', old_price: '' }
    const productId = Number(draft.product_id)
    const offerPrice = Number(draft.offer_price)
    const oldPrice = draft.old_price.trim() ? Number(draft.old_price) : undefined
    if (!Number.isFinite(productId) || productId <= 0) {
      alert('Choose a product first.')
      return
    }
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      alert('Offer price must be greater than 0.')
      return
    }
    if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice <= 0)) {
      alert('Old price must be greater than 0 when provided.')
      return
    }

    setSavingItemForOffer(offer.id)
    try {
      const updated = await offersApi.addItem(offer.id, {
        product_id: productId,
        offer_price: offerPrice,
        old_price: oldPrice,
        is_active: true,
      })
      setOfferInState(updated as Offer)
      setItemDrafts((prev) => ({ ...prev, [offer.id]: { product_id: '', offer_price: '', old_price: '' } }))
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not add product to offer.')
    } finally {
      setSavingItemForOffer(null)
    }
  }

  const removeOfferItem = async (offerId: number, itemId: number) => {
    if (!confirm('Remove this product from the offer?')) return
    setDeletingItemId(itemId)
    try {
      const updated = await offersApi.removeItem(offerId, itemId)
      setOfferInState(updated as Offer)
    } catch {
      alert('Could not remove product from offer.')
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-2xl font-bold text-stone-900">Offers</h2>
          <p className="text-sm text-stone-500 mt-0.5">Create seasonal campaigns and link specific products at discounted prices.</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Offer
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="card p-10 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-amber-700 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Loading offers...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="card p-12 text-center">
          <Percent className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-600 font-medium mb-1">No offers yet</p>
          <p className="text-sm text-stone-400 mb-4">Create your first offer and add discounted products.</p>
          <button type="button" onClick={openCreate} className="btn-primary">Create Offer</button>
        </div>
      ) : (
        <div className="space-y-5">
          {offers.map((offer) => {
            const draft = itemDrafts[offer.id] || { product_id: '', offer_price: '', old_price: '' }
            return (
              <div key={offer.id} className="card overflow-hidden">
                <div className="p-5 border-b border-stone-200 bg-gradient-to-r from-stone-900 to-amber-900 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`badge ${offer.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-stone-200 text-stone-700 border-stone-300'}`}>
                          {offer.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {offer.badge && (
                          <span className="badge bg-amber-100 text-amber-800 border-amber-200">
                            <Tag className="w-3 h-3" />
                            {offer.badge}
                          </span>
                        )}
                        {offer.ends_at && (
                          <span className="badge bg-white/20 text-white border-white/20">
                            <Calendar className="w-3 h-3" />
                            Ends {formatDateTime(offer.ends_at)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-2xl">{offer.title}</h3>
                      {offer.description && <p className="text-sm text-stone-200 mt-1">{offer.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEdit(offer)} className="btn-ghost bg-white/10 text-white hover:bg-white/20">Edit</button>
                      <button
                        type="button"
                        onClick={() => removeOffer(offer.id)}
                        disabled={deletingOfferId === offer.id}
                        className="btn-ghost bg-red-500/20 text-red-100 hover:bg-red-500/30 disabled:opacity-60"
                      >
                        {deletingOfferId === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {offer.items.length === 0 ? (
                    <p className="text-sm text-stone-500">No products attached yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {offer.items.map((item) => (
                        <div key={item.id} className="border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-900 truncate">{item.product_name || `Product #${item.product_id}`}</p>
                            <p className="text-xs text-stone-500">
                              {item.product_size || '-'} | Stock: {item.stock_quantity ?? '-'} | Normal: {formatCurrency(Number(item.old_price ?? item.regular_price ?? 0))}
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-green-700">{formatCurrency(Number(item.offer_price))}</div>
                          <button
                            type="button"
                            onClick={() => removeOfferItem(offer.id, item.id)}
                            disabled={deletingItemId === item.id}
                            className="btn-ghost text-red-600 hover:bg-red-50"
                          >
                            {deletingItemId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
                    <p className="text-sm font-medium text-stone-800 mb-3">Add Product To Offer</p>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                      <select
                        className="input"
                        value={draft.product_id}
                        onChange={(e) => setDraft(offer.id, (prev) => ({ ...prev, product_id: e.target.value }))}
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} {product.size ? `(${product.size})` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder="Offer price"
                        value={draft.offer_price}
                        onChange={(e) => setDraft(offer.id, (prev) => ({ ...prev, offer_price: e.target.value }))}
                      />
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder="Old price (optional)"
                        value={draft.old_price}
                        onChange={(e) => setDraft(offer.id, (prev) => ({ ...prev, old_price: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => addOfferItem(offer)}
                        disabled={savingItemForOffer === offer.id}
                        className="btn-primary justify-center"
                      >
                        {savingItemForOffer === offer.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Item</>}
                      </button>
                    </div>
                    {draft.product_id && (
                      <p className="text-xs text-stone-500 mt-2">
                        Selected regular price:{' '}
                        {formatCurrency(Number(productById[Number(draft.product_id)]?.price || 0))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <OfferEditorModal
        open={formOpen}
        form={form}
        setForm={setForm}
        saving={savingForm}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSave={saveOffer}
        editingTitle={editingId ? 'Edit Offer' : 'Create Offer'}
      />
    </div>
  )
}
