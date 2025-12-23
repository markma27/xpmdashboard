'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Organization } from '@/lib/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface OrgSelectorProps {
  organizations: Organization[]
  activeOrgId: string | null
}

export function OrgSelector({ organizations, activeOrgId: initialActiveOrgId }: OrgSelectorProps) {
  const router = useRouter()
  const [activeOrgId, setActiveOrgId] = useState<string | null>(initialActiveOrgId)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    // Load from localStorage as fallback
    const stored = localStorage.getItem('active_org_id')
    if (stored && organizations.some(org => org.id === stored)) {
      setActiveOrgId(stored)
    } else if (organizations.length > 0 && !activeOrgId) {
      // If no active org is set, use the first org and set it via API
      const firstOrgId = organizations[0].id
      setActiveOrgId(firstOrgId)
      localStorage.setItem('active_org_id', firstOrgId)
      // Set cookie via API to ensure server-side access
      fetch('/api/org/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: firstOrgId }),
      }).catch(err => {
        console.error('Failed to set active org cookie:', err)
      })
    }
  }, [organizations, activeOrgId])

  const handleOrgChange = (orgId: string) => {
    setActiveOrgId(orgId)
    localStorage.setItem('active_org_id', orgId)
    // Set cookie via API
    fetch('/api/org/set-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    router.refresh()
  }

  const activeOrg = organizations.find(org => org.id === activeOrgId)

  if (!isClient) {
    return <div className="h-10 w-48 animate-pulse bg-muted rounded-md" />
  }

  if (organizations.length === 0) {
    return (
      <Button
        variant="outline"
        onClick={() => router.push('/onboarding/create-org')}
      >
        <Plus className="mr-2 h-4 w-4" />
        Create Organization
      </Button>
    )
  }

  return (
    <Select value={activeOrgId || undefined} onValueChange={handleOrgChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select Organization">
          {activeOrg?.name || 'Select Organization'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
            {org.role === 'admin' && (
              <span className="ml-2 text-xs text-muted-foreground">(Admin)</span>
            )}
          </SelectItem>
        ))}
        <SelectItem
          value="__create__"
          onSelect={() => router.push('/onboarding/create-org')}
          className="text-primary"
        >
          <Plus className="mr-2 h-4 w-4 inline" />
          Create New Organization
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

