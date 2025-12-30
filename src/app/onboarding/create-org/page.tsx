'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export default function CreateOrgPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const slug = generateSlug(name)
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.error || 'Failed to create organisation'
        console.error('Organisation creation error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      // Set active org
      await fetch('/api/org/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: data.id }),
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create organisation, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-[400px] space-y-8">
        {/* Logo */}
        <div className="flex justify-center mb-2 scale-110">
          <div className="relative w-64 h-24">
            <Image
              src="/Logo_login.svg"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Create Org Card */}
        <Card className="shadow-xl border-slate-200/60 rounded-2xl overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-blue-50 via-green-50 to-green-50/30 py-4 flex items-center justify-center border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Create Organisation</h2>
          </div>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Organisation Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="My Accounting Firm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 text-sm bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-brand/5 transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">
                  Organisation slug will be: <span className="font-mono text-slate-600">{name ? generateSlug(name) : 'example-org'}</span>
                </p>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full h-11 bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 font-bold text-sm shadow-lg shadow-brand/10 mt-2" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : 'Create Organisation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
