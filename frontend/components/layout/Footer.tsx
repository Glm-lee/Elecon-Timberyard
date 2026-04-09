import Link from 'next/link'
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import BrandLogo from '@/components/brand/BrandLogo'
import { whatsappUrl } from '@/lib/contacts'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <BrandLogo variant="light" size="sm" className="h-10 w-auto" />
            </div>
            <p className="text-stone-400 leading-relaxed max-w-xs mb-6">Premium quality timber for every construction project. Serving Nairobi and Kenya since 2005.</p>
            <div className="flex gap-3">
              <a href={whatsappUrl('Hello, I need timber')} target="_blank" rel="noopener"
                className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm hover:bg-green-600/30 transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <Link href="/chat?source=footer"
                className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 text-amber-400 rounded-lg text-sm hover:bg-amber-600/30 transition-colors">
                <MessageCircle className="w-4 h-4" /> Live Chat
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider mb-4">Quick Links</p>
            <ul className="space-y-2.5">
              {[{ href: '/products', label: 'All Products' }, { href: '/offers', label: 'Special Offers' }, { href: '/about', label: 'About Us' }, { href: '/contact', label: 'Contact' }, { href: '/chat?source=footer', label: 'Get a Quote' }].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-stone-400 hover:text-stone-200 transition-colors text-sm">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm text-stone-500 font-medium uppercase tracking-wider mb-4">Contact</p>
            <ul className="space-y-3.5">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-stone-400 text-sm">Juja, Nairobi, Kenya</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <a href="tel:+254700000000" className="text-stone-400 hover:text-stone-200 text-sm">+254 700 000 000</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <a href="mailto:info@elecontimberyard.co.ke" className="text-stone-400 hover:text-stone-200 text-sm">info@elecontimberyard.co.ke</a>
              </li>
            </ul>
            <div className="mt-5 pt-5 border-t border-stone-800">
              <p className="text-xs text-stone-600">Mon-Sat: 7:00 AM - 6:00 PM</p>
              <p className="text-xs text-stone-600">Sunday: 8:00 AM - 2:00 PM</p>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-600">&copy; {year} Elecon Timberyard. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

