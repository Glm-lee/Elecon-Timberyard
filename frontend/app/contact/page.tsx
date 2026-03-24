import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-stone-50 min-h-screen pt-24">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-amber-700 text-sm font-semibold tracking-wider uppercase mb-3">Contact Us</p>
          <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6">Talk to Elecon Timberyard</h1>
          <p className="text-stone-600 text-lg leading-relaxed max-w-3xl">
            Reach out for stock checks, quotes, project support, and delivery scheduling.
            We respond fastest on phone and WhatsApp.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-7 border border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900 mb-5">Direct Contacts</h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">Phone</p>
                    <a href="tel:+254700000000" className="text-stone-600 hover:text-amber-700">
                      +254 700 000 000
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">Email</p>
                    <a href="mailto:info@elecontimberyard.co.ke" className="text-stone-600 hover:text-amber-700">
                      info@elecontimberyard.co.ke
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">Location</p>
                    <p className="text-stone-600">Industrial Area, Nairobi, Kenya</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="card p-7 border border-stone-200">
              <h2 className="font-serif text-2xl text-stone-900 mb-5">Fastest Ways to Reach Us</h2>
              <div className="space-y-3">
                <a
                  href="https://wa.me/254700000000"
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Chat
                </a>
                <Link
                  href="/chat?source=contact_page"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-700 text-white font-medium hover:bg-amber-800"
                >
                  <MessageCircle className="w-4 h-4" />
                  Website Live Chat
                </Link>
              </div>
              <div className="mt-6 pt-6 border-t border-stone-200">
                <p className="text-stone-700 font-medium">Business Hours</p>
                <p className="text-sm text-stone-600 mt-2">Mon-Sat: 7:00 AM - 6:00 PM</p>
                <p className="text-sm text-stone-600">Sunday: 8:00 AM - 2:00 PM</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
