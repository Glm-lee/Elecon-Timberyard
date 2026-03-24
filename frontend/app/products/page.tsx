'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { productsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Search, Package, ArrowRight, Loader2, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'

const TYPES = ['All','Structural','Hardwood','Softwood','Treated','Plywood']

const DEMO = [
  { id:1, name:'2x4 Pine Timber', wood_type:'Softwood', size:'2x4 inch', price:350, stock_quantity:500, description:'Standard pine for framing.', availability:'in_stock', created_at:'', updated_at:'' },
  { id:2, name:'4x4 Cypress Post', wood_type:'Softwood', size:'4x4 inch', price:850, stock_quantity:200, description:'Durable cypress posts.', availability:'in_stock', created_at:'', updated_at:'' },
  { id:3, name:'Mahogany Plank', wood_type:'Hardwood', size:'1x6 inch', price:1200, stock_quantity:80, description:'Premium African mahogany.', availability:'in_stock', created_at:'', updated_at:'' },
  { id:4, name:'Mvule Board', wood_type:'Hardwood', size:'2x8 inch', price:1800, stock_quantity:45, description:'Heavy-duty mvule.', availability:'in_stock', created_at:'', updated_at:'' },
  { id:5, name:'CCA Treated Post', wood_type:'Treated', size:'3x3 inch', price:550, stock_quantity:300, description:'Pressure-treated for outdoor use.', availability:'in_stock', created_at:'', updated_at:'' },
  { id:6, name:'Roof Battens', wood_type:'Structural', size:'1x2 inch', price:180, stock_quantity:1000, description:'Lightweight battens for roofing.', availability:'in_stock', created_at:'', updated_at:'' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>(DEMO)
  const [filtered, setFiltered] = useState<any[]>(DEMO)
  const [activeType, setActiveType] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [quoteLoadingId, setQuoteLoadingId] = useState<number | null>(null)
  const [cart, setCart] = useState<Array<{ product: any; quantity: number }>>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0)

  const addToOrder = (product: any) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id)
      if (idx === -1) return [...prev, { product, quantity: 1 }]
      return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item)
    })
  }

  const changeCartQty = (productId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item)
        .filter(item => item.quantity > 0)
    )
  }

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
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

  const downloadQuote = async (product: any) => {
    const rawQty = window.prompt(`Enter quantity for ${product.name}`, '1')
    if (rawQty === null) return

    const qty = Number(rawQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Please enter a valid quantity (greater than 0).')
      return
    }

    setQuoteLoadingId(product.id)
    try {
      const payload = {
        customer_name: 'Walk-in Customer',
        items: [
          {
            description: `${product.name}${product.size ? ` (${product.size})` : ''}`,
            qty,
            unit: 'piece',
            unit_price: Number(product.price),
            subtotal: Number(product.price) * qty,
          },
        ],
        notes: 'Auto-generated quote from product catalog.',
      }

      const res = await fetch('/api/documents/quote/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to generate quote PDF')
      }

      const blob = await res.blob()
      downloadBlobAsFile(blob, `Elecon_Quote_${product.id}.pdf`, res.headers.get('content-disposition'))
    } catch {
      alert('Could not generate quote right now. Please try again.')
    } finally {
      setQuoteLoadingId(null)
    }
  }

  const placeOrderAndDownloadInvoice = async () => {
    if (cart.length === 0) {
      setOrderError('Add at least one product to proceed.')
      return
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setOrderError('Customer name and phone are required.')
      return
    }

    setPlacingOrder(true)
    setOrderError('')
    try {
      const orderPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        delivery_location: deliveryLocation.trim() || undefined,
        source_channel: 'website',
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      }

      const orderRes = await fetch('/api/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })

      if (!orderRes.ok) {
        let detail = 'Could not create order.'
        try {
          const err = await orderRes.json()
          if (typeof err?.detail === 'string') detail = err.detail
        } catch {}
        throw new Error(detail)
      }

      const order = await orderRes.json()
      const orderId = order?.id
      if (!orderId) throw new Error('Order created but ID missing from response.')

      const invoiceRes = await fetch(`/api/documents/invoice/${orderId}`)
      if (invoiceRes.ok) {
        const blob = await invoiceRes.blob()
        downloadBlobAsFile(blob, `Elecon_Invoice_${orderId}.pdf`, invoiceRes.headers.get('content-disposition'))
        alert(`Order #${orderId} created and invoice downloaded.`)
      } else {
        alert(`Order #${orderId} created, but invoice download failed.`)
      }

      setCart([])
      setCheckoutOpen(false)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setDeliveryLocation('')
    } catch (err: any) {
      setOrderError(err?.message || 'Could not create order.')
    } finally {
      setPlacingOrder(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    productsApi.list({ limit: 100 })
      .then(data => { if (data?.length) { setProducts(data); setFiltered(data) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = products
    if (activeType !== 'All') result = result.filter((p:any) => p.wood_type?.toLowerCase().includes(activeType.toLowerCase()))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p:any) => p.name?.toLowerCase().includes(q) || p.wood_type?.toLowerCase().includes(q) || p.size?.toLowerCase().includes(q))
    }
    setFiltered(result)
  }, [activeType, search, products])

  return (
    <>
      <Navbar />
      <section className="pt-28 pb-12 bg-stone-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-3">Our Products</h1>
          <p className="text-stone-400 text-lg max-w-xl">Browse our full catalogue. All prices include VAT. Ask for bulk discounts on orders above 100m.</p>
        </div>
      </section>

      <section className="sticky top-16 md:top-20 z-30 bg-white border-b border-stone-200 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TYPES.map(type => (
              <button key={type} onClick={() => setActiveType(type)}
                className={'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ' + (activeType === type ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')}>
                {type}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input className="input py-2 pl-9 text-sm" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="py-12 bg-stone-50 min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {cartCount > 0 && (
            <div className="card p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-200 bg-amber-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-700 text-white flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">{cartCount} item{cartCount !== 1 ? 's' : ''} in your order</p>
                  <p className="text-xs text-stone-600">Total: {formatCurrency(cartTotal)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="btn-primary btn-sm justify-center">
                Review Order
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(6)].map((_,i) => <div key={i} className="card p-6 animate-pulse"><div className="h-4 bg-stone-200 rounded mb-3 w-2/3" /><div className="h-3 bg-stone-100 rounded mb-4 w-1/2" /><div className="h-8 bg-stone-200 rounded" /></div>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-400">No products found. Try a different filter.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-500 mb-6">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((product:any) => (
                  <div key={product.id} className="card p-6 flex flex-col group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">{product.wood_type}</span>
                      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (product.stock_quantity === 0 ? 'bg-red-50 text-red-600' : product.stock_quantity < 50 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>
                        {product.stock_quantity === 0 ? 'Out of stock' : product.stock_quantity < 50 ? 'Low stock' : 'In stock'}
                      </span>
                    </div>
                    <h3 className="font-serif font-semibold text-stone-900 text-lg mb-1">{product.name}</h3>
                    <p className="text-sm text-stone-500 font-mono mb-2">{product.size}</p>
                    {product.description && <p className="text-sm text-stone-600 leading-relaxed mb-4 flex-1">{product.description}</p>}
                    {!!cart.find(item => item.product.id === product.id) && (
                      <p className="text-xs text-green-700 mb-3">
                        In order: {cart.find(item => item.product.id === product.id)?.quantity}
                      </p>
                    )}
                    <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
                      <span className="font-serif font-bold text-xl text-stone-900">{formatCurrency(product.price)}</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => downloadQuote(product)}
                          disabled={quoteLoadingId === product.id}
                          className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 group-hover:gap-2 transition-all disabled:opacity-50"
                        >
                          {quoteLoadingId === product.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              Quote <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => addToOrder(product)}
                          className="flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-stone-900">Review Order</h2>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="btn-ghost btn-sm">Close</button>
            </div>

            <div className="p-6 space-y-6">
              {cart.length === 0 ? (
                <p className="text-stone-500 text-sm">No items selected yet.</p>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product.id} className="card p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">{item.product.name}</p>
                        <p className="text-xs text-stone-500">{item.product.size} · {formatCurrency(Number(item.product.price))} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => changeCartQty(item.product.id, -1)} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center justify-center">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-stone-800">{item.quantity}</span>
                        <button type="button" onClick={() => changeCartQty(item.product.id, 1)} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeFromCart(item.product.id)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="w-24 text-right text-sm font-semibold text-stone-900">{formatCurrency(Number(item.product.price) * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="card p-4 bg-stone-50 border-stone-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer Name *</label>
                    <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. James Kamau" />
                  </div>
                  <div>
                    <label className="label">Phone Number *</label>
                    <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div>
                    <label className="label">Email (optional)</label>
                    <input className="input" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
                  </div>
                  <div>
                    <label className="label">Delivery Location (optional)</label>
                    <input className="input" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} placeholder="e.g. Westlands, Nairobi" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="font-serif text-2xl font-bold text-stone-900">Total: {formatCurrency(cartTotal)}</p>
                <button
                  type="button"
                  onClick={placeOrderAndDownloadInvoice}
                  disabled={placingOrder || cart.length === 0}
                  className="btn-primary"
                >
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
