import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function HomePage() {
  const user = await getSessionUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-4xl font-bold">XPM Dashboard</h1>
        <p className="text-muted-foreground">
          Multi-tenant analytics platform for Xero Practice Manager
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

