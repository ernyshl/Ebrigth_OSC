'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useAutomations, useToggleAutomation, useDuplicateAutomation, useDeleteAutomation,
} from '@/hooks/crm/useAutomations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranchContext } from '@/components/crm/branch-context'
import {
  Zap, Plus, Copy, Trash2, Edit, CheckCircle, XCircle, Loader2, Clock,
} from 'lucide-react'

const TRIGGER_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  STAGE_CHANGED: 'Stage Changed',
  TAG_ADDED: 'Tag Added',
  TAG_REMOVED: 'Tag Removed',
  TIME_IN_STAGE: 'Time in Stage',
  SCHEDULED: 'Scheduled',
  FORM_SUBMITTED: 'Form Submitted',
  INCOMING_MESSAGE: 'Incoming Message',
  CUSTOM_FIELD_CHANGED: 'Field Changed',
  APPOINTMENT_BOOKED: 'Appointment Booked',
  CONTACT_REPLIED: 'Contact Replied',
  NO_REPLY_AFTER: 'No Reply After',
}

interface AutomationsListClientProps {
  userId: string
}

export function AutomationsListClient({ userId: _userId }: AutomationsListClientProps) {
  const router = useRouter()
  const { selectedBranch } = useBranchContext()
  const { data, isLoading } = useAutomations(selectedBranch?.id)
  const toggle = useToggleAutomation()
  const duplicate = useDuplicateAutomation()
  const remove = useDeleteAutomation()

  const automations = (data as { id: string; name: string; triggerType: string; enabled: boolean; runs?: { status: string; startedAt: string }[] }[] | undefined) ?? []

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggle.mutateAsync({ id, enabled: !current })
      toast.success(current ? 'Automation disabled' : 'Automation enabled')
    } catch {
      toast.error('Failed to toggle automation')
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicate.mutateAsync(id)
      toast.success('Automation duplicated')
    } catch {
      toast.error('Failed to duplicate')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await remove.mutateAsync(id)
      toast.success('Automation deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visual workflows that run automatically on triggers.</p>
        </div>
        <Button onClick={() => router.push('/crm/automations/new')}>
          <Plus className="h-4 w-4 mr-2" /> New Automation
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && automations.length === 0 && (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed">
          <Zap className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No automations yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first workflow to automate lead communication.</p>
          <Button className="mt-4" onClick={() => router.push('/crm/automations/new')}>
            <Plus className="h-4 w-4 mr-2" /> Create Automation
          </Button>
        </div>
      )}

      {!isLoading && automations.length > 0 && (
        <div className="space-y-2">
          {automations.map((a) => {
            const lastRun = a.runs?.[0]
            return (
              <div
                key={a.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2 rounded-lg ${a.enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">{TRIGGER_LABELS[a.triggerType] ?? a.triggerType}</Badge>
                      {lastRun && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {lastRun.status === 'COMPLETED' && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {lastRun.status === 'FAILED' && <XCircle className="h-3 w-3 text-red-500" />}
                          {lastRun.status === 'RUNNING' && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                          {lastRun.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(a.id, a.enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${a.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => router.push(`/crm/automations/${a.id}`)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(a.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(a.id, a.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
