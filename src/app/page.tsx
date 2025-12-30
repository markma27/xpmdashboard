import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

export default async function HomePage() {
  const user = await getSessionUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md w-full px-6 space-y-10 text-center">
        {/* Logo Section */}
        <div className="flex justify-center mb-4 scale-110">
          <div className="relative w-80 h-32">
            <Image
              src="/Logo_login.svg"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <p className="text-xl font-semibold text-slate-700 max-w-sm mx-auto tracking-tight">
            Advanced Analytics & Reporting for Xero Practice Manager
          </p>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            Empowering accounting firms with real-time insights into productivity, recoverability, and WIP.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3 justify-center pt-4 max-w-[240px] mx-auto">
          <Button asChild size="lg" className="w-full bg-black text-white hover:bg-black/80 active:bg-black/70 active:scale-[0.98] transition-all duration-150 h-11 font-bold">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 h-11 font-semibold text-slate-600">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
        </div>

        {/* Features Preview */}
        <div className="pt-10 border-t border-slate-200/60">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Insights</div>
              <div className="text-xs font-semibold text-slate-600">Real-time</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Multi-tenant</div>
              <div className="text-xs font-semibold text-slate-600">Secure</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporting</div>
              <div className="text-xs font-semibold text-slate-600">Advanced</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

