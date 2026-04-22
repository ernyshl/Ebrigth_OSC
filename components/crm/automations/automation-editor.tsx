'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  type NodeTypes, Handle, Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAutomation, useCreateAutomation, useUpdateAutomation } from '@/hooks/crm/useAutomations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/crm/utils'
import {
  ArrowLeft, Save, Zap, Clock, GitBranch, Play, Send,
  Tag, ArrowRight, User, CheckSquare, Bell, Edit3, Webhook, MessageSquare,
} from 'lucide-react'

// ─── Node type icons ──────────────────────────────────────
const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sendWhatsApp: MessageSquare,
  sendEmail: Send,
  sendSms: MessageSquare,
  addTag: Tag,
  removeTag: Tag,
  moveStage: ArrowRight,
  assignUser: User,
  createTask: CheckSquare,
  delay: Clock,
  ifElse: GitBranch,
  sendNotification: Bell,
  updateField: Edit3,
  sendWebhook: Webhook,
}

const ACTION_COLORS: Record<string, string> = {
  trigger: 'border-blue-500 bg-blue-50',
  sendWhatsApp: 'border-green-500 bg-green-50',
  sendEmail: 'border-purple-500 bg-purple-50',
  delay: 'border-amber-500 bg-amber-50',
  ifElse: 'border-orange-500 bg-orange-50',
  moveStage: 'border-teal-500 bg-teal-50',
  default: 'border-gray-300 bg-white',
}

// ─── Custom node: Trigger ─────────────────────────────────
function TriggerNode({ data }: { data: { label: string; triggerType: string } }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 min-w-[200px] shadow-sm', ACTION_COLORS.trigger)}>
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Trigger</span>
      </div>
      <p className="font-medium text-gray-900 text-sm">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  )
}

// ─── Custom node: Action ──────────────────────────────────
function ActionNode({ data }: { data: { label: string; actionType: string; config?: Record<string, unknown> } }) {
  const Icon = ACTION_ICONS[data.actionType] ?? Play
  const colorClass = ACTION_COLORS[data.actionType] ?? ACTION_COLORS.default
  return (
    <div className={cn('rounded-xl border-2 p-4 min-w-[200px] shadow-sm', colorClass)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-gray-600" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</span>
      </div>
      <p className="font-medium text-gray-900 text-sm">{data.label}</p>
      {data.config?.body && (
        <p className="text-xs text-gray-400 mt-1 truncate">{String(data.config.body)}</p>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

// ─── Custom node: Delay ───────────────────────────────────
function DelayNode({ data }: { data: { label: string; amount?: number; unit?: string } }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 min-w-[160px] shadow-sm', ACTION_COLORS.delay)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <Clock className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Wait</span>
      </div>
      <p className="font-medium text-gray-900 text-sm">
        {data.amount ? `${data.amount} ${data.unit ?? 'minutes'}` : 'Set delay…'}
      </p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

// ─── Custom node: Condition ───────────────────────────────
function ConditionNode({ data }: { data: { label: string } }) {
  return (
    <div className={cn('rounded-xl border-2 p-4 min-w-[200px] shadow-sm', ACTION_COLORS.ifElse)}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-4 w-4 text-orange-600" />
        <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">If / Else</span>
      </div>
      <p className="font-medium text-gray-900 text-sm">{data.label}</p>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '33%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '66%' }} />
      <div className="flex justify-between mt-2 text-xs text-gray-400 px-1">
        <span>Yes</span><span>No</span>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  delay: DelayNode,
  condition: ConditionNode,
}

// ─── Node palette items ───────────────────────────────────
const PALETTE = [
  { type: 'action', actionType: 'sendWhatsApp', label: 'Send WhatsApp' },
  { type: 'action', actionType: 'sendEmail', label: 'Send Email' },
  { type: 'action', actionType: 'sendSms', label: 'Send SMS' },
  { type: 'action', actionType: 'addTag', label: 'Add Tag' },
  { type: 'action', actionType: 'removeTag', label: 'Remove Tag' },
  { type: 'action', actionType: 'moveStage', label: 'Move Stage' },
  { type: 'action', actionType: 'assignUser', label: 'Assign User' },
  { type: 'action', actionType: 'createTask', label: 'Create Task' },
  { type: 'action', actionType: 'sendNotification', label: 'Internal Notification' },
  { type: 'action', actionType: 'updateField', label: 'Update Field' },
  { type: 'action', actionType: 'sendWebhook', label: 'Send Webhook' },
  { type: 'delay', label: 'Wait / Delay' },
  { type: 'condition', label: 'If / Else' },
]

const TRIGGER_OPTIONS = [
  { value: 'NEW_LEAD', label: 'New Lead Created' },
  { value: 'STAGE_CHANGED', label: 'Stage Changed' },
  { value: 'TAG_ADDED', label: 'Tag Added' },
  { value: 'TAG_REMOVED', label: 'Tag Removed' },
  { value: 'TIME_IN_STAGE', label: 'Time Elapsed in Stage' },
  { value: 'SCHEDULED', label: 'Date/Time Scheduled' },
  { value: 'FORM_SUBMITTED', label: 'Form Submitted' },
  { value: 'INCOMING_MESSAGE', label: 'Incoming Message' },
  { value: 'CUSTOM_FIELD_CHANGED', label: 'Custom Field Changed' },
  { value: 'APPOINTMENT_BOOKED', label: 'Appointment Booked' },
  { value: 'CONTACT_REPLIED', label: 'Contact Replied' },
  { value: 'NO_REPLY_AFTER', label: 'No Reply After X Time' },
]

let nodeCounter = 100

interface AutomationEditorProps {
  automationId: string | null
  userId: string
}

export function AutomationEditor({ automationId, userId: _userId }: AutomationEditorProps) {
  const router = useRouter()
  const { data: automation, isLoading } = useAutomation(automationId ?? '')
  const createAutomation = useCreateAutomation()
  const updateAutomation = useUpdateAutomation()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [name, setName] = useState('New Automation')
  const [triggerType, setTriggerType] = useState<string>('NEW_LEAD')
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load existing automation
  useEffect(() => {
    const a = automation as { name?: string; triggerType?: string; enabled?: boolean; graph?: { nodes?: Node[]; edges?: Edge[] } } | undefined
    if (!a) return
    setName(a.name ?? 'New Automation')
    setTriggerType(a.triggerType ?? 'NEW_LEAD')
    setEnabled(a.enabled ?? false)

    const g = a.graph as { nodes?: Node[]; edges?: Edge[] } | undefined
    if (g?.nodes?.length) {
      setNodes(g.nodes)
      setEdges(g.edges ?? [])
    } else {
      initDefaultGraph(a.triggerType ?? 'NEW_LEAD')
    }
  }, [automation]) // eslint-disable-line react-hooks/exhaustive-deps

  function initDefaultGraph(trigger: string) {
    const label = TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label ?? trigger
    setNodes([{ id: 'trigger-1', type: 'trigger', position: { x: 200, y: 50 }, data: { label, triggerType: trigger } }])
    setEdges([])
  }

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  // Auto-save debounced
  useEffect(() => {
    if (!automationId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await updateAutomation.mutateAsync({ id: automationId, data: { graph: { nodes, edges } as unknown as never } })
      } catch {
        // silent autosave failures
      }
    }, 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [nodes, edges]) // eslint-disable-line react-hooks/exhaustive-deps

  function addNode(item: (typeof PALETTE)[number]) {
    const id = `node-${++nodeCounter}`
    const newNode: Node = {
      id,
      type: item.type,
      position: { x: 200, y: nodes.length * 120 + 200 },
      data: {
        label: item.label,
        actionType: (item as { actionType?: string }).actionType,
      },
    }
    setNodes((ns) => [...ns, newNode])
    // Auto-connect to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1]
      setEdges((es) => addEdge({ source: lastNode.id, target: id, id: `e-${lastNode.id}-${id}` }, es))
    }
  }

  async function handleSave() {
    setSaving(true)
    const graph = { nodes, edges }
    try {
      if (automationId) {
        await updateAutomation.mutateAsync({ id: automationId, data: { name, triggerType: triggerType as never, graph: graph as never, enabled } })
      } else {
        const created = await createAutomation.mutateAsync({
          name,
          triggerType: triggerType as never,
          graph: graph as never,
          enabled,
        })
        const c = created as { id: string }
        router.replace(`/crm/automations/${c.id}`)
      }
      toast.success('Automation saved')
    } catch {
      toast.error('Failed to save automation')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading && automationId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm z-10">
        <Button variant="ghost" size="icon" onClick={() => router.push('/crm/automations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white min-w-0 flex-1"
          placeholder="Automation name…"
        />
        <select
          value={triggerType}
          onChange={(e) => {
            setTriggerType(e.target.value)
            initDefaultGraph(e.target.value)
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700"
        >
          {TRIGGER_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Enabled</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </label>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node palette */}
        <div className="w-52 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto p-3 gap-1 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add Node</p>
          {PALETTE.map((item) => {
            const Icon = ACTION_ICONS[(item as { actionType?: string }).actionType ?? item.type] ?? Play
            return (
              <button
                key={`${item.type}-${item.label}`}
                onClick={() => addNode(item)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50 dark:bg-gray-950"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Status badge */}
        <div className="absolute bottom-6 right-6 z-10">
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {enabled ? 'Live' : 'Draft'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
