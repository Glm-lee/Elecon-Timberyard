'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, MessageCircle, Phone } from 'lucide-react'
import BrandLogo from '@/components/brand/BrandLogo'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const pinnedLight = pathname === '/' && !scrolled

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const headerClass = !pinnedLight
    ? 'fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-200'
    : 'fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-transparent'

  return (
    <header className={headerClass}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo variant={pinnedLight ? 'light' : 'dark'} size="sm" priority className="h-10 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className={pathname === link.href
                  ? 'px-4 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-50'
                  : 'px-4 py-2 rounded-lg text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="tel:+254700000000" className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-amber-700 transition-colors">
              <Phone className="w-4 h-4" />
              <span className="font-medium">+254 700 000 000</span>
            </a>
            <Link href="/chat?source=navbar" className="btn-primary btn-sm">
              <MessageCircle className="w-4 h-4" /> Talk to Us
            </Link>
          </div>

          <button className="md:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 border-t border-stone-200 mt-2 pt-4 space-y-1">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                className={pathname === link.href
                  ? 'block px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700'
                  : 'block px-4 py-2.5 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100'
                }>
                {link.label}
              </Link>
            ))}
            <div className="pt-3">
              <Link href="/chat?source=mobile_nav" onClick={() => setOpen(false)}
                className="flex items-center gap-2 mx-4 px-4 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-medium justify-center">
                <MessageCircle className="w-4 h-4" /> Talk to Us
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
