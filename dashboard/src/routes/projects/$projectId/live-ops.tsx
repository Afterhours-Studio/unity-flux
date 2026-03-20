import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import {
  Plus, Trash2, Pencil, Copy, Play, Square, CalendarDays,
  Zap, Trophy, ShoppingBag, Award, Wrench, CalendarCheck, Loader2, Skull,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'
import { formatDistanceToNow, format, addDays } from 'date-fns'
import type { LiveOpsEvent, LiveOpsEventType, LiveOpsStatus, BattlePassTier } from '@/types/project'
import {
  useLiveOpsEvents, useCreateLiveOpsEvent, useUpdateLiveOpsEvent, useDeleteLiveOpsEvent,
  useBattlePassTiers, useCreateBattlePassTier, useUpdateBattlePassTier, useDeleteBattlePassTier,
} from '@/hooks/use-live-ops'
import { LIVE_OPS_TEMPLATES, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/live-ops-templates'

// FullCalendar
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

export const Route = createFileRoute('/projects/$projectId/live-ops')({
  component: LiveOpsPage,
})

const STATUS_COLORS: Record<LiveOpsStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  live: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  ended: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
}

const ICON_MAP: Record<string, typeof Zap> = {
  CalendarCheck, Zap, ShoppingBag, Trophy, Award, Wrench, CalendarDays, Skull,
}

/* ═══════════════════════════════════════════════
   Create Event Dialog
   ═══════════════════════════════════════════════ */

function CreateEventDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
}) {
  const createMut = useCreateLiveOpsEvent()
  const [step, setStep] = useState<'template' | 'form'>('template')
  const [selectedType, setSelectedType] = useState<LiveOpsEventType>('custom')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 7))
  const [color, setColor] = useState('#3b82f6')

  const handleSelectTemplate = (type: LiveOpsEventType) => {
    const tpl = LIVE_OPS_TEMPLATES.find((t) => t.type === type)
    setSelectedType(type)
    if (tpl) {
      setName(tpl.name)
      setDescription(tpl.description)
      setColor(tpl.color)
      setEndDate(addDays(new Date(), tpl.defaultDurationDays || 7))
    }
    setStep('form')
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      const tpl = LIVE_OPS_TEMPLATES.find((t) => t.type === selectedType)
      await createMut.mutateAsync({
        projectId,
        event: {
          name: name.trim(),
          description: description.trim(),
          type: selectedType,
          status: 'draft',
          startAt: startDate?.toISOString() ?? new Date().toISOString(),
          endAt: endDate?.toISOString() ?? addDays(new Date(), 7).toISOString(),
          color,
          config: tpl?.defaultConfig ?? {},
          recurring: null,
        },
      })
      toast.success(`Event "${name}" created`)
      onOpenChange(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event')
    }
  }

  const resetForm = () => {
    setStep('template')
    setName('')
    setDescription('')
    setSelectedType('custom')
    setStartDate(new Date())
    setEndDate(addDays(new Date(), 7))
    setColor('#3b82f6')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{step === 'template' ? 'Choose Template' : 'Create Event'}</DialogTitle>
          <DialogDescription>
            {step === 'template' ? 'Select an event type or start from scratch.' : 'Configure your event details.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'template' ? (
          <div className="px-6 py-4 grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {LIVE_OPS_TEMPLATES.map((tpl) => (
              <button
                key={tpl.type}
                onClick={() => handleSelectTemplate(tpl.type)}
                className="flex items-start gap-3 p-3 border rounded-lg text-left hover:bg-accent/50 transition-colors"
              >
                <div className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: tpl.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{tpl.description}</p>
                </div>
              </button>
            ))}
            <button
              onClick={() => { setSelectedType('custom'); setStep('form') }}
              className="flex items-start gap-3 p-3 border rounded-lg text-left hover:bg-accent/50 transition-colors border-dashed"
            >
              <div className="h-2 w-2 rounded-full shrink-0 mt-1.5 bg-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">Custom Event</p>
                <p className="text-[11px] text-muted-foreground">Start from scratch</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4 max-h-[400px] overflow-y-auto">
            <div className="grid gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Event description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Start</Label>
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">End</Label>
                <DatePicker value={endDate} onChange={setEndDate} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="text-xs font-mono flex-1" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 pb-6 pt-2">
          {step === 'form' && (
            <Button variant="outline" onClick={() => setStep('template')}>Back</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 'form' && (
            <Button onClick={handleCreate} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Events Tab
   ═══════════════════════════════════════════════ */

function EventsTab({ projectId, events, onEdit }: {
  projectId: string
  events: LiveOpsEvent[]
  onEdit: (e: LiveOpsEvent) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const updateMut = useUpdateLiveOpsEvent()
  const deleteMut = useDeleteLiveOpsEvent()

  const handleSetStatus = async (event: LiveOpsEvent, status: LiveOpsStatus) => {
    try {
      await updateMut.mutateAsync({ id: event.id, updates: { status } })
      toast.success(`${event.name} is now ${status}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <CalendarDays className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium mb-1">No events yet</p>
            <p className="text-xs text-muted-foreground mb-4">Create your first live ops event</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = ICON_MAP[LIVE_OPS_TEMPLATES.find((t) => t.type === event.type)?.icon ?? ''] ?? CalendarDays
            return (
              <Card key={event.id} className="group p-3 sm:p-4 overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_10px_rgba(255,255,255,0.04)]">
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-0">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors"
                      style={{ backgroundColor: event.color + '15', color: event.color, borderColor: event.color + '30' }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <p className="text-base font-bold tracking-tight truncate">{event.name}</p>
                        <Badge variant="secondary" className={cn('text-xs h-6 px-2.5 border-0 font-medium shrink-0', STATUS_COLORS[event.status])}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
                        <span>{EVENT_TYPE_LABELS[event.type]}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        <span>{format(new Date(event.startAt), 'MMM d, yyyy')} - {format(new Date(event.endAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pl-[58px] sm:pl-0 shrink-0">
                    {event.status === 'draft' && (
                      <Button size="icon" variant="outline" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleSetStatus(event, 'scheduled')} title="Schedule">
                        <CalendarDays className="h-[18px] w-[18px]" />
                      </Button>
                    )}
                    {(event.status === 'scheduled' || event.status === 'draft') && (
                      <Button size="icon" variant="outline" className="h-9 w-9 text-emerald-500 hover:text-emerald-400" onClick={() => handleSetStatus(event, 'live')} title="Set Live">
                        <Play className="h-[18px] w-[18px]" />
                      </Button>
                    )}
                    {event.status === 'live' && (
                      <Button size="icon" variant="outline" className="h-9 w-9 text-red-500 hover:text-red-400" onClick={() => handleSetStatus(event, 'ended')} title="End Event">
                        <Square className="h-[18px] w-[18px]" />
                      </Button>
                    )}
                    <Button size="icon" variant="outline" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => onEdit(event)} title="Edit">
                      <Pencil className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      size="icon" variant="outline" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await deleteMut.mutateAsync(event.id)
                        toast.success(`Deleted "${event.name}"`)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
    </>
  )
}

/* ═══════════════════════════════════════════════
   Battle Pass Tab
   ═══════════════════════════════════════════════ */

function BattlePassTab({ events }: { events: LiveOpsEvent[] }) {
  const seasonEvents = events.filter((e) => e.type === 'season_pass')
  const [selectedEventId, setSelectedEventId] = useState(seasonEvents[0]?.id ?? '')
  const { data: tiers = [], isLoading } = useBattlePassTiers(selectedEventId)
  const createTierMut = useCreateBattlePassTier()
  const updateTierMut = useUpdateBattlePassTier()
  const deleteTierMut = useDeleteBattlePassTier()

  if (seasonEvents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-12">
          <Award className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium mb-1">No Season Pass events</p>
          <p className="text-xs text-muted-foreground">Create a Season Pass event in the Events tab first.</p>
        </CardContent>
      </Card>
    )
  }

  const handleAddTier = async () => {
    const nextTier = tiers.length > 0 ? Math.max(...tiers.map((t) => t.tier)) + 1 : 1
    try {
      await createTierMut.mutateAsync({
        eventId: selectedEventId,
        tier: { tier: nextTier, xpRequired: nextTier * 1000, freeReward: '', premiumReward: '' },
      })
    } catch {
      toast.error('Failed to add tier')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs shrink-0">Season Pass</Label>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="h-8 text-xs w-64">
            <SelectValue placeholder="Select event..." />
          </SelectTrigger>
          <SelectContent>
            {seasonEvents.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Tier</TableHead>
                  <TableHead className="w-28">XP Required</TableHead>
                  <TableHead>Free Reward</TableHead>
                  <TableHead>Premium Reward</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.tier}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={t.xpRequired}
                        onChange={(e) => updateTierMut.mutate({
                          id: t.id, eventId: selectedEventId,
                          updates: { xpRequired: parseInt(e.target.value) || 0 },
                        })}
                        className="h-7 text-xs w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={t.freeReward}
                        onChange={(e) => updateTierMut.mutate({
                          id: t.id, eventId: selectedEventId,
                          updates: { freeReward: e.target.value },
                        })}
                        className="h-7 text-xs"
                        placeholder="e.g. 500 coins"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={t.premiumReward}
                        onChange={(e) => updateTierMut.mutate({
                          id: t.id, eventId: selectedEventId,
                          updates: { premiumReward: e.target.value },
                        })}
                        className="h-7 text-xs"
                        placeholder="e.g. Exclusive skin"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => deleteTierMut.mutate({ id: t.id, eventId: selectedEventId })}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddTier}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Tier
          </Button>
          {tiers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tiers.length} tiers - Total XP: {tiers.reduce((s, t) => s + t.xpRequired, 0).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Calendar Tab
   ═══════════════════════════════════════════════ */

function CalendarTab({ events, onEdit }: { events: LiveOpsEvent[]; onEdit: (e: LiveOpsEvent) => void }) {
  const updateMut = useUpdateLiveOpsEvent()

  const calendarEvents = useMemo(() =>
    events.map((e) => ({
      id: e.id,
      title: e.name,
      start: e.startAt,
      end: e.endAt,
      color: e.color,
      allDay: true,
      extendedProps: { event: e },
    })),
    [events],
  )

  return (
    <div className="flux-calendar">
      <style>{`
        .flux-calendar .fc {
          --fc-border-color: color-mix(in oklch, currentColor 12%, transparent);
          --fc-button-bg-color: color-mix(in oklch, currentColor 6%, transparent);
          --fc-button-border-color: color-mix(in oklch, currentColor 12%, transparent);
          --fc-button-hover-bg-color: color-mix(in oklch, currentColor 12%, transparent);
          --fc-button-hover-border-color: color-mix(in oklch, currentColor 20%, transparent);
          --fc-button-active-bg-color: oklch(0.77 0.16 70 / 0.15);
          --fc-button-active-border-color: oklch(0.77 0.16 70 / 0.3);
          --fc-button-text-color: inherit;
          --fc-today-bg-color: oklch(0.77 0.16 70 / 0.06);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: color-mix(in oklch, currentColor 3%, transparent);
          --fc-event-border-color: transparent;
          --fc-small-font-size: 0.8em;
          --fc-neutral-text-color: color-mix(in oklch, currentColor 50%, transparent);
          font-family: inherit;
          font-size: 13px;
        }

        /* Toolbar */
        .flux-calendar .fc .fc-toolbar { margin-bottom: 1.25rem; gap: 0.75rem; padding: 0.75rem 0.75rem 0; }
        .flux-calendar .fc .fc-toolbar-title { font-size: 1.1em; font-weight: 600; }
        .flux-calendar .fc .fc-button {
          font-size: 12px; padding: 6px 14px; border-radius: 8px;
          font-weight: 500; text-transform: none;
          transition: all 0.15s ease;
        }
        .flux-calendar .fc .fc-button:focus { box-shadow: none; }
        .flux-calendar .fc .fc-button-active {
          background: oklch(0.77 0.16 70 / 0.15) !important;
          border-color: oklch(0.77 0.16 70 / 0.3) !important;
          color: oklch(0.77 0.16 70) !important;
        }
        .flux-calendar .fc .fc-button-group { gap: 2px; }
        .flux-calendar .fc .fc-button-group .fc-button { border-radius: 8px; }

        /* Header cells */
        .flux-calendar .fc .fc-col-header-cell {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 10px 0;
          background: color-mix(in oklch, currentColor 3%, transparent);
        }

        /* Day cells */
        .flux-calendar .fc .fc-daygrid-day { min-height: 90px; transition: background 0.15s; }
        .flux-calendar .fc .fc-daygrid-day:hover { background: color-mix(in oklch, currentColor 5%, transparent); }
        .flux-calendar .fc .fc-daygrid-day-number { font-size: 12px; padding: 6px 8px; font-weight: 500; }
        .flux-calendar .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background: oklch(0.77 0.16 70); color: black;
          border-radius: 50%; width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          margin: 4px 4px 0 auto; font-weight: 600;
        }

        /* Events */
        .flux-calendar .fc .fc-event {
          border-radius: 6px; padding: 3px 8px; font-size: 11px;
          font-weight: 500; cursor: pointer;
          border: none; border-left: 3px solid currentColor;
          transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        .flux-calendar .fc .fc-event:hover {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
        }
        .flux-calendar .fc .fc-daygrid-event-dot { display: none; }
        .flux-calendar .fc .fc-event-time { display: none; }

        /* More link */
        .flux-calendar .fc .fc-daygrid-more-link {
          font-size: 10px; font-weight: 600; padding: 2px 6px;
          color: oklch(0.77 0.16 70); border-radius: 4px;
          transition: background 0.15s;
        }
        .flux-calendar .fc .fc-daygrid-more-link:hover {
          background: oklch(0.77 0.16 70 / 0.1);
        }

        /* Scrollbar */
        .flux-calendar .fc .fc-scroller { scrollbar-width: thin; }

        /* Outer container */
        .flux-calendar .fc .fc-scrollgrid {
          border: 1px solid color-mix(in oklch, currentColor 15%, transparent);
          border-radius: 10px; overflow: hidden;
        }
        .flux-calendar .fc .fc-scrollgrid td:last-child { border-right: none; }
        .flux-calendar .fc .fc-scrollgrid tr:last-child td { border-bottom: none; }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev',
          center: 'title',
          right: 'next',
        }}
        events={calendarEvents}
        editable={true}
        eventDrop={async (info) => {
          const event = info.event.extendedProps.event as LiveOpsEvent
          try {
            await updateMut.mutateAsync({
              id: event.id,
              updates: {
                startAt: info.event.start?.toISOString() ?? event.startAt,
                endAt: info.event.end?.toISOString() ?? event.endAt,
              },
            })
            toast.success(`Rescheduled "${event.name}"`)
          } catch {
            info.revert()
            toast.error('Failed to reschedule')
          }
        }}
        eventResize={async (info) => {
          const event = info.event.extendedProps.event as LiveOpsEvent
          try {
            await updateMut.mutateAsync({
              id: event.id,
              updates: { endAt: info.event.end?.toISOString() ?? event.endAt },
            })
          } catch {
            info.revert()
          }
        }}
        eventClick={(info) => {
          const event = info.event.extendedProps.event as LiveOpsEvent
          onEdit(event)
        }}
        height="auto"
        dayMaxEvents={3}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Edit Event Dialog
   ═══════════════════════════════════════════════ */

function EditEventDialog({
  event,
  open,
  onOpenChange,
}: {
  event: LiveOpsEvent | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const updateMut = useUpdateLiveOpsEvent()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<LiveOpsStatus>('draft')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [color, setColor] = useState('#3b82f6')

  // Sync form when event changes
  const eventId = event?.id
  useEffect(() => {
    if (event) {
      setName(event.name)
      setDescription(event.description)
      setStatus(event.status)
      setStartDate(new Date(event.startAt))
      setEndDate(new Date(event.endAt))
      setColor(event.color)
    }
  }, [eventId, open])

  const handleSave = async () => {
    if (!event) return
    try {
      await updateMut.mutateAsync({
        id: event.id,
        updates: {
          name: name.trim(),
          description: description.trim(),
          status,
          startAt: startDate?.toISOString() ?? event.startAt,
          endAt: endDate?.toISOString() ?? event.endAt,
          color,
        },
      })
      toast.success('Event updated')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  if (!event) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            {EVENT_TYPE_LABELS[event.type]} - {event.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4 max-h-[400px] overflow-y-auto">
          <div className="grid gap-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LiveOpsStatus)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Start</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">End</Label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="text-xs font-mono flex-1" />
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════ */

function LiveOpsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/live-ops' })
  const { data: events = [], isLoading } = useLiveOpsEvents(projectId)
  const [tab, setTab] = useState<'events' | 'battlepass' | 'calendar'>('events')
  const [editEvent, setEditEvent] = useState<LiveOpsEvent | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PageTransition className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Ops</h1>
          <p className="text-sm text-muted-foreground">
            Schedule events, manage battle passes, and view your live ops calendar.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { key: 'events' as const, label: 'Events', icon: Zap },
          { key: 'battlepass' as const, label: 'Battle Pass', icon: Award },
          { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'events' && <EventsTab projectId={projectId} events={events} onEdit={setEditEvent} />}
      {tab === 'battlepass' && <BattlePassTab events={events} />}
      {tab === 'calendar' && <CalendarTab events={events} onEdit={setEditEvent} />}

      {/* Edit dialog */}
      <EditEventDialog event={editEvent} open={!!editEvent} onOpenChange={(v) => { if (!v) setEditEvent(null) }} />
    </PageTransition>
  )
}
