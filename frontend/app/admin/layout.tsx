'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import Link from 'next/link'
import { LayoutDashboard, MessageSquare, Package, ShoppingCart, Users, LogOut, Menu, X, Bell } from 'lucide-react'
import Cookies from 'js-cookie'
import BrandLogo from '@/components/brand/BrandLogo'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/inbox',     icon: MessageSquare,   label: 'Inbox' },
  { href: '/admin/products',  icon: Package,          label: 'Products' },
  { href: '/admin/orders',    icon: ShoppingCart,     label: 'Orders' },
  { href: '/admin/leads',     icon: Users,            label: 'Leads' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, fetchMe, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = Cookies.get('elecon_token')
    if (!token) {
      if (!pathname.includes('/admin/login')) {
        router.replace('/admin/login')
      }
      setChecked(true)
      return
    }
    fetchMe().finally(() => setChecked(true))
  }, [])

  if (!checked) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const token = Cookies.get('elecon_token')
  if (!token && !pathname.includes('/admin/login')) {
    return null
  }

  const pageTitle = pathname.split('/').pop()?.replace(/-/g,' ') || 'Dashboard'

  const Sidebar = () => (
    <aside className="w-64 bg-white border-r border-stone-200 flex flex-col h-full">
      <div className="px-6 py-5 border-b border-stone-200 flex items-center gap-3">
        <div className="flex flex-col">
          <BrandLogo variant="dark" size="sm" className="h-9 w-auto" />
          <p className="text-xs text-stone-400 mt-1">Admin Portal</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={'sidebar-link ' + (active ? 'active' : '')}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-stone-200 space-y-0.5">
        {user && <div className="px-4 py-3 rounded-lg bg-stone-50 mb-2"><p className="text-xs font-semibold text-stone-800 truncate">{user.name || user.email}</p><p className="text-xs text-stone-400 capitalize">{user.role}</p></div>}
        <button onClick={logout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600"><LogOut className="w-4 h-4" /><span>Sign out</span></button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      <div className="hidden md:flex md:flex-shrink-0"><Sidebar /></div>
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex-shrink-0"><Sidebar /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-stone-200 px-4 md:px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <button className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1"><h1 className="font-serif font-semibold text-stone-900 capitalize">{pageTitle}</h1></div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg text-stone-500 hover:bg-stone-100"><Bell className="w-5 h-5" /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-600 rounded-full" /></button>
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><span className="text-xs font-bold text-amber-700">{user?.name?.slice(0,2).toUpperCase() || 'AD'}</span></div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
    </div>
  )
}
