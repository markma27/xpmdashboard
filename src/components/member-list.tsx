'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, UserPlus } from 'lucide-react'

interface Member {
  id: string
  role: string
  created_at: string
  users: {
    id: string
    email: string
  }
}

interface MemberListProps {
  organizationId: string
}

export function MemberList({ organizationId }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [organizationId])

  const loadMembers = async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)

    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      if (response.ok) {
        setEmail('')
        setRole('viewer')
        setShowInviteForm(false)
        loadMembers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to invite member')
      }
    } catch (error) {
      console.error('Invite error:', error)
      alert('Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadMembers()
      } else {
        alert('Failed to remove member')
      }
    } catch (error) {
      console.error('Remove error:', error)
      alert('Failed to remove member')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-slate-500">Loading members...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-4 px-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-800">Organisation Members</h3>
          <p className="text-xs text-slate-500 mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button 
          onClick={() => setShowInviteForm(!showInviteForm)}
          size="sm"
          className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold text-xs"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {showInviteForm && (
        <Card className="mx-6 mb-4 shadow-sm border-slate-200">
          <CardHeader className="py-2 px-6 flex items-center justify-center bg-gradient-to-r from-blue-50 via-green-100 to-green-50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Invite Member</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-4">
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-slate-600 uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-medium text-slate-600 uppercase tracking-wider">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={inviting}
                  size="sm"
                  className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] transition-all duration-150 h-9 px-4 font-semibold text-xs"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInviteForm(false)
                    setEmail('')
                    setRole('viewer')
                  }}
                  className="h-9 px-4 font-semibold text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {members.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] mx-6">
          <p className="text-sm text-slate-500">No members yet.</p>
        </div>
      ) : (
        <div className="px-6 pb-4">
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <th className="text-left p-3 font-bold text-slate-700 border-r">Email</th>
                    <th className="text-left p-3 font-bold text-slate-700 border-r bg-slate-50/30">Role</th>
                    <th className="text-left p-3 font-bold text-slate-700 border-r bg-slate-50/30">Joined</th>
                    <th className="text-center p-3 font-bold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 border-r">
                        <div className="font-semibold text-slate-700">{member.users?.email || 'Unknown'}</div>
                      </td>
                      <td className="p-3 border-r">
                        <span className="capitalize text-slate-600">{member.role}</span>
                      </td>
                      <td className="p-3 border-r">
                        <span className="text-slate-600">{new Date(member.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemove(member.users.id)}
                          className="h-8 px-3 text-[12px] font-semibold"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

