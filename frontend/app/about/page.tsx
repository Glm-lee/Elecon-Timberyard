import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import { CheckCircle, Shield, Truck, Trees } from 'lucide-react'

const highlights = [
  'Quality-graded timber from trusted suppliers',
  'Fast quotation and reliable lead times',
  'Bulk and project-based supply support',
  'Support over phone, WhatsApp, and live chat',
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="bg-stone-50 min-h-screen pt-24">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-amber-700 text-sm font-semibold tracking-wider uppercase mb-3">About Elecon</p>
          <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">Built on Trust. Driven by Quality Timber.</h1>
          <p className="text-stone-600 text-lg leading-relaxed max-w-3xl">
            Elecon Timberyard has served contractors, developers, and homeowners across Kenya since 2005.
            We focus on dependable stock, practical advice, and fast service so your projects keep moving.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <div className="card p-6 border border-stone-200">
              <Shield className="w-6 h-6 text-amber-700 mb-3" />
              <h2 className="font-semibold text-stone-900 mb-2">Quality Assurance</h2>
              <p className="text-sm text-stone-600">Every delivery is checked for grade, size consistency, and project readiness.</p>
            </div>
            <div className="card p-6 border border-stone-200">
              <Truck className="w-6 h-6 text-amber-700 mb-3" />
              <h2 className="font-semibold text-stone-900 mb-2">Reliable Delivery</h2>
              <p className="text-sm text-stone-600">Scheduled dispatch across Nairobi and neighboring regions.</p>
            </div>
            <div className="card p-6 border border-stone-200">
              <Trees className="w-6 h-6 text-amber-700 mb-3" />
              <h2 className="font-semibold text-stone-900 mb-2">Wide Timber Range</h2>
              <p className="text-sm text-stone-600">From structural softwoods to premium hardwood selections.</p>
            </div>
          </div>

          <div className="card p-8 border border-stone-200">
            <h2 className="font-serif text-2xl text-stone-900 mb-5">Why Teams Choose Elecon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <p className="text-stone-700">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link href="/contact" className="btn-primary">
                Contact Our Team
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
