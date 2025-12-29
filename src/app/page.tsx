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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-md w-full px-6 space-y-8 text-center">
        {/* Logo Section */}
        <div className="flex justify-center mb-4">
          <div className="relative w-64 h-20">
            <Image
              src="/Logo.svg"
              alt="XPM Dashboard Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            XPM Dashboard
          </h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto">
            Multi-tenant analytics platform for Xero Practice Manager
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>

        {/* Features Preview */}
        <div className="pt-8 border-t">
          <p className="text-sm text-muted-foreground mb-4">Key Features</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Analytics</div>
              <div className="text-muted-foreground text-xs">Real-time insights</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Multi-tenant</div>
              <div className="text-muted-foreground text-xs">Organization isolation</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Secure</div>
              <div className="text-muted-foreground text-xs">Role-based access</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

