'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import BrandLogo from '@/components/brand/BrandLogo'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, isLoading, error, token } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  useEffect(() => { if (token) router.replace('/admin/dashboard') }, [token, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await login(email, password); router.push('/admin/dashboard') } catch {}
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <BrandLogo variant="light" size="md" className="h-12 w-auto" priority />
          </div>
          <p className="text-xs text-stone-500 tracking-wider uppercase mb-2">Timberyard Admin</p>
          <h1 className="font-serif text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-stone-400 text-sm">Sign in to the admin dashboard</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <div>
              <label className="label">Email or Username</label>
              <input className="input" placeholder="admin@elecon.co.ke" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPw ? 'text' : 'password'} placeholder="........" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading || !email || !password} className="btn-primary w-full justify-center py-3">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-stone-600 mt-6">Elecon Timberyard Internal Admin System</p>
      </div>
    </div>
  )
}

