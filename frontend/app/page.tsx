import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { MessageCircle, ArrowRight, CheckCircle, Star, Truck, Shield, Phone, Package, Users, TrendingUp } from 'lucide-react'
import { whatsappUrl, PHONE_DISPLAY } from '@/lib/contacts'

const categories = [
  { name: 'Structural Timber', desc: 'Heavy-duty timber for construction, roofing, and framing.', tag: 'Most popular', color: 'bg-amber-50 border-amber-200' },
  { name: 'Hardwoods', desc: 'Premium hardwoods for furniture, flooring, and finishing.', tag: 'Premium', color: 'bg-green-50 border-green-200' },
  { name: 'Softwoods', desc: 'Versatile softwoods for interior fit-out and lightweight frames.', tag: 'Great value', color: 'bg-stone-50 border-stone-200' },
  { name: 'Treated Timber', desc: 'Pressure-treated for outdoor use, fencing, and ground contact.', tag: 'Long lasting', color: 'bg-orange-50 border-orange-200' },
]

const stats = [
  { value: '18+', label: 'Years in business', icon: TrendingUp },
  { value: '4,000+', label: 'Projects supplied', icon: Package },
  { value: '1,200+', label: 'Happy clients', icon: Users },
  { value: '48hr', label: 'Nairobi delivery', icon: Truck },
]

const reviews = [
  { name: 'James Kamau', role: 'Construction Contractor', review: 'Elecon has been our go-to timber supplier for 6 years. Consistent quality and always delivers on time.', stars: 5 },
  { name: 'Grace Wanjiku', role: 'Interior Designer', review: 'The hardwood selection is excellent. Found exactly what I needed for a premium furniture project.', stars: 5 },
  { name: 'Peter Otieno', role: 'Site Manager', review: 'Good prices and stock is always available. The WhatsApp ordering system makes reordering very easy.', stars: 4 },
]

export default function HomePage() {
  return (
    <>
      <Navbar />
      <section className="relative min-h-screen flex items-center bg-stone-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-amber-950/50 to-green-950/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-300 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Serving Nairobi and Kenya since 2005
            </div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Quality Timber,{' '}
              <span className="text-amber-400">Every Project.</span>
            </h1>
            <p className="text-xl text-stone-300 leading-relaxed mb-10 max-w-xl">
              From structural frames to premium hardwoods -- get instant quotes, check live stock, and order via WhatsApp, Instagram, or our website.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href={whatsappUrl('Hello, I need timber')} target="_blank" rel="noopener"
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-all shadow-lg hover:-translate-y-0.5">
                <MessageCircle className="w-5 h-5" />
                <div className="text-left"><div className="text-sm font-semibold">WhatsApp</div><div className="text-xs opacity-75">Chat instantly</div></div>
              </a>
              <Link href="/chat?source=homepage_hero"
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-medium transition-all shadow-lg hover:-translate-y-0.5">
                <MessageCircle className="w-5 h-5" />
                <div className="text-left"><div className="text-sm font-semibold">Website Chat</div><div className="text-xs opacity-75">AI-powered sales</div></div>
              </Link>
              <a href="tel:+254700000000"
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-white font-medium transition-all shadow-lg hover:-translate-y-0.5">
                <Phone className="w-5 h-5" />
                <div className="text-left"><div className="text-sm font-semibold">Call Us</div><div className="text-xs opacity-75">{PHONE_DISPLAY}</div></div>
              </a>
            </div>
            <div className="flex flex-wrap gap-6 text-stone-400 text-sm">
              {['Free delivery over KES 50,000', 'Same-day quote', 'Stock guaranteed'].map(t => (
                <div key={t} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" />{t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-700 mb-3"><Icon className="w-5 h-5" /></div>
                  <div className="font-serif text-3xl font-bold text-stone-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-stone-500">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-amber-700 font-medium text-sm tracking-wider uppercase mb-3">Our Range</p>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold text-stone-900 mb-4">Timber for Every Purpose</h2>
            <p className="text-lg text-stone-500 max-w-2xl mx-auto">All timber sourced from certified suppliers with quality graded on arrival.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map(cat => (
              <Link key={cat.name} href={'/products?type=' + cat.name.toLowerCase().replace(/\s+/g,'_')}
                className={'card p-6 border-2 group cursor-pointer hover:shadow-md transition-all ' + cat.color}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-serif font-semibold text-lg text-stone-900">{cat.name}</h3>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 text-stone-600">{cat.tag}</span>
                </div>
                <p className="text-sm text-stone-600 mb-4 leading-relaxed">{cat.desc}</p>
                <div className="flex items-center text-amber-700 text-sm font-medium group-hover:gap-2 transition-all">
                  View products <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/products" className="btn-outline">Browse Full Catalogue <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-amber-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-3">We are here -- Talk to us</h2>
              <p className="text-amber-100 text-lg">Reach us on your preferred channel. Our AI sales assistant is available 24/7.</p>
            </div>
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <a href={whatsappUrl('Hello, I need timber')} target="_blank" rel="noopener"
                className="flex items-center gap-2 px-5 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-colors shadow-lg">
                <MessageCircle className="w-5 h-5" /> WhatsApp
              </a>
              <Link href="/chat?source=cta_banner"
                className="flex items-center gap-2 px-5 py-3 bg-amber-900 text-white rounded-xl font-semibold hover:bg-amber-950 transition-colors shadow-lg">
                <MessageCircle className="w-5 h-5" /> Live Chat
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl font-semibold text-stone-900 mb-3">What Our Clients Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map(r => (
              <div key={r.name} className="card p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(r.stars)].map((_,i) => <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />)}
                </div>
                <p className="text-stone-700 text-sm leading-relaxed mb-5 italic">&ldquo;{r.review}&rdquo;</p>
                <div>
                  <p className="font-semibold text-stone-900 text-sm">{r.name}</p>
                  <p className="text-stone-500 text-xs">{r.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}



