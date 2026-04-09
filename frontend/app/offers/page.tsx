'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { offersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ArrowRight, Clock3, Flame, Loader2, Minus, Percent, Plus, ShoppingCart, Tag, Trash2 } from 'lucide-react'

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
  items: OfferItem[]
}

type OfferCartItem = {
  id: string
  offerId: number
  offerTitle: string
  item: OfferItem
  quantity: number
}

function formatCountdown(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, expired: true }
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes, expired: false }
}

function OfferCountdown({ endsAt }: { endsAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!endsAt) return null

  const target = new Date(endsAt).getTime()
  if (Number.isNaN(target)) return null
  const left = formatCountdown(target - now)

  if (left.expired) {
    return (
      <p className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700">
        <Clock3 className="w-3.5 h-3.5" />
        Offer ended
      </p>
    )
  }

  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800">
      <Clock3 className="w-3.5 h-3.5" />
      Ends in {left.days}d {left.hours}h {left.minutes}m
    </p>
  )
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loadingOffers, setLoadingOffers] = useState(true)
  const [offerError, setOfferError] = useState('')
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [cart, setCart] = useState<OfferCartItem[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')

  useEffect(() => {
    setLoadingOffers(true)
    setOfferError('')
    offersApi.listPublic()
      .then((rows) => setOffers(Array.isArray(rows) ? rows : []))
      .catch(() => setOfferError('Could not load offers right now. Please try again shortly.'))
      .finally(() => setLoadingOffers(false))
  }, [])

  const getQty = (itemId: number) => quantities[itemId] ?? 1
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.item.offer_price || 0) * line.quantity, 0), [cart])

  const changeOfferQty = (itemId: number, delta: number) => {
    const next = Math.max(1, getQty(itemId) + delta)
    setQuantities((prev) => ({ ...prev, [itemId]: next }))
  }

  const addOfferToCart = (offer: Offer, item: OfferItem) => {
    const qty = getQty(item.id)
    const lineId = `${offer.id}:${item.id}`
    setOrderError('')
    setCart((prev) => {
      const idx = prev.findIndex((line) => line.id === lineId)
      if (idx === -1) {
        return [...prev, { id: lineId, offerId: offer.id, offerTitle: offer.title, item, quantity: qty }]
      }
      return prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, quantity: line.quantity + qty } : line))
    })
  }

  const changeCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => (line.id === cartItemId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    )
  }

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((line) => line.id !== cartItemId))
  }

  const downloadBlobAsFile = (blob: Blob, fallbackName: string, contentDisposition?: string | null) => {
    const objectUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const match = (contentDisposition || '').match(/filename="([^"]+)"/i)
    a.href = objectUrl
    a.download = match?.[1] || fallbackName
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(objectUrl)
  }

  const placeOfferOrder = async () => {
    if (cart.length === 0) {
      setOrderError('Add at least one offer item to proceed.')
      return
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setOrderError('Customer name and phone are required.')
      return
    }

    const missingProduct = cart.find((line) => !line.item.product_id)
    if (missingProduct) {
      setOrderError(`Product mapping is missing for "${missingProduct.item.product_name || 'selected item'}".`)
      return
    }

    const outOfStock = cart.find((line) => line.item.stock_quantity != null && line.quantity > Number(line.item.stock_quantity))
    if (outOfStock) {
      setOrderError(
        `${outOfStock.item.product_name || 'Product'} has only ${outOfStock.item.stock_quantity} in stock, but your cart has ${outOfStock.quantity}.`
      )
      return
    }

    setPlacingOrder(true)
    setOrderError('')
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        delivery_location: deliveryLocation.trim() || undefined,
        source_channel: 'website_offers',
        items: cart.map((line) => ({
          product_id: line.item.product_id,
          quantity: line.quantity,
          unit_price_override: Number(line.item.offer_price),
        })),
      }

      const orderRes = await fetch('/api/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!orderRes.ok) {
        let detail = 'Could not create offer order.'
        try {
          const err = (await orderRes.json()) as { detail?: string }
          if (typeof err.detail === 'string') detail = err.detail
        } catch {}
        throw new Error(detail)
      }

      const order = (await orderRes.json()) as { id?: number }
      const orderId = order?.id
      if (!orderId) throw new Error('Order created but ID missing from response.')

      const invoiceRes = await fetch(`/api/documents/invoice/${orderId}`)
      if (invoiceRes.ok) {
        const blob = await invoiceRes.blob()
        downloadBlobAsFile(blob, `Elecon_Offer_Invoice_${orderId}.pdf`, invoiceRes.headers.get('content-disposition'))
        alert(`Offer order #${orderId} created and invoice downloaded.`)
      } else {
        alert(`Offer order #${orderId} created, but invoice download failed.`)
      }

      setCart([])
      setCheckoutOpen(false)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setDeliveryLocation('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create offer order.'
      setOrderError(message)
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="bg-stone-50 min-h-screen pt-24">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-amber-700 text-sm font-semibold tracking-wider uppercase mb-3">Limited Deals</p>
          <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-5">Special Timber Offers</h1>
          <p className="text-stone-600 text-lg max-w-3xl leading-relaxed">
            Pick quantity, add offer items to cart, and check out at discounted prices.
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {cartCount > 0 && (
            <div className="card p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-200 bg-amber-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-700 text-white flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">{cartCount} item{cartCount !== 1 ? 's' : ''} in your offer cart</p>
                  <p className="text-xs text-stone-600">Offer total: {formatCurrency(cartTotal)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="btn-primary btn-sm justify-center">
                Review Order
              </button>
            </div>
          )}

          {loadingOffers ? (
            <div className="card p-10 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-amber-700 mx-auto mb-3" />
              <p className="text-sm text-stone-500">Loading live offers...</p>
            </div>
          ) : offerError ? (
            <div className="card p-6 border-red-200 bg-red-50 text-red-700 text-sm">{offerError}</div>
          ) : offers.length === 0 ? (
            <div className="card p-12 text-center">
              <Flame className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-600 font-medium mb-1">No active offers right now</p>
              <p className="text-sm text-stone-400">Check back shortly for new promotions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {offers.map((offer) => (
                <article key={offer.id} className="card border border-stone-200 overflow-hidden">
                  <div className="p-6 md:p-7 border-b border-stone-100 bg-gradient-to-r from-stone-900 to-amber-900 text-white">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20">
                        <Flame className="w-3.5 h-3.5" />
                        {offer.badge || 'Special Offer'}
                      </span>
                      <OfferCountdown endsAt={offer.ends_at} />
                    </div>
                    <h2 className="font-serif text-2xl md:text-3xl mb-2">{offer.title}</h2>
                    {offer.description && <p className="text-stone-200 text-sm">{offer.description}</p>}
                  </div>

                  <div className="p-6 md:p-7">
                    <div className="space-y-3">
                      {offer.items.map((item) => {
                        const oldPrice = Number(item.old_price ?? item.regular_price ?? item.offer_price)
                        const offerPrice = Number(item.offer_price)
                        const saved = Math.max(oldPrice - offerPrice, 0)
                        const qty = getQty(item.id)
                        return (
                          <div key={`${offer.id}-${item.id}`} className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-stone-900">{item.product_name || `Product #${item.product_id}`}</p>
                                <p className="text-xs text-stone-500">{item.product_size || 'Standard size'} | Stock: {item.stock_quantity ?? '-'}</p>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-sm text-stone-400 line-through">{formatCurrency(oldPrice)}</span>
                                <span className="text-lg font-semibold text-green-700">{formatCurrency(offerPrice)}</span>
                                <span className="badge border-green-200 bg-green-50 text-green-700">
                                  <Percent className="w-3 h-3" />
                                  Save {formatCurrency(saved)}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => changeOfferQty(item.id, -1)}
                                  className="w-7 h-7 rounded-md text-stone-600 hover:bg-stone-100 flex items-center justify-center"
                                  aria-label={`Reduce quantity for ${item.product_name || 'offer item'}`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-medium text-stone-900">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => changeOfferQty(item.id, 1)}
                                  className="w-7 h-7 rounded-md text-stone-600 hover:bg-stone-100 flex items-center justify-center"
                                  aria-label={`Increase quantity for ${item.product_name || 'offer item'}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="text-sm font-semibold text-stone-700">Total: {formatCurrency(offerPrice * qty)}</div>

                              <button type="button" onClick={() => addOfferToCart(offer, item)} className="btn-primary btn-sm justify-center">
                                Order Now
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-5 pt-5 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {offer.terms && (
                        <p className="text-xs text-stone-500 inline-flex items-start gap-2">
                          <Tag className="w-3.5 h-3.5 mt-0.5 text-amber-700" />
                          {offer.terms}
                        </p>
                      )}
                      <Link href="/products" className="text-sm font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-1">
                        View full catalogue <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-stone-900">Offer Checkout</h2>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="btn-ghost btn-sm">Close</button>
            </div>

            <div className="p-6 space-y-6">
              {cart.length === 0 ? (
                <p className="text-stone-500 text-sm">No offer items selected yet.</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <div key={line.id} className="card p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{line.item.product_name || `Product #${line.item.product_id}`}</p>
                        <p className="text-xs text-stone-500">{line.offerTitle} | {formatCurrency(Number(line.item.offer_price))} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => changeCartQty(line.id, -1)} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center justify-center">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-stone-800">{line.quantity}</span>
                        <button type="button" onClick={() => changeCartQty(line.id, 1)} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeFromCart(line.id)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="w-28 text-right text-sm font-semibold text-stone-900">{formatCurrency(Number(line.item.offer_price) * line.quantity)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="card p-4 bg-stone-50 border-stone-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer Name *</label>
                    <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. James Kamau" />
                  </div>
                  <div>
                    <label className="label">Phone Number *</label>
                    <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div>
                    <label className="label">Email (optional)</label>
                    <input className="input" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
                  </div>
                  <div>
                    <label className="label">Delivery Location (optional)</label>
                    <input className="input" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="e.g. Westlands, Nairobi" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="font-serif text-2xl font-bold text-stone-900">Total: {formatCurrency(cartTotal)}</p>
                <button type="button" onClick={placeOfferOrder} disabled={placingOrder || cart.length === 0} className="btn-primary">
                  {placingOrder ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Order...</> : 'Confirm Order & Download Invoice'}
                </button>
              </div>

              {orderError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {orderError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
