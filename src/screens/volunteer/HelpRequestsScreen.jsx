import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const STATUS_STYLE = {
  pending:     'bg-error-container text-on-error-container border-error',
  in_progress: 'bg-primary-container text-on-primary-container border-black',
  resolved:    'bg-surface-variant text-on-surface border-black',
}
const TYPE_BG = {
  medical:   'bg-error-container/60',
  technical: 'bg-tertiary-container/60',
  general:   'bg-surface-container',
}

export default function HelpRequestsScreen() {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  const loadRequests = useCallback(async () => {
    let q = supabase
      .from('help_requests')
      .select('*, profiles(full_name, team_code)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRequests(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadRequests()
    const ch = supabase
      .channel('admin_help_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests' }, loadRequests)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadRequests])

  async function updateStatus(id, status) {
    const updates = { status }
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    const { error } = await supabase.from('help_requests').update(updates).eq('id', id)
    if (error) toast.error('Update failed')
    else toast.success(`Marked as ${status.replace('_', ' ')}`)
  }

  const FILTERS = ['pending', 'in_progress', 'resolved', 'all']

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Help Requests</h1>
        {filter === 'pending' && requests.length > 0 && (
          <span className="bg-error-container border-2 border-error text-on-error-container font-headline font-black text-sm uppercase italic px-3 py-1 rounded-xl animate-wiggle">
            {requests.length} urgent
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 border-4 border-black font-headline font-black text-xs uppercase italic rounded-2xl transition-all ${
              filter === f ? 'bg-primary-container text-on-primary-container drop-block' : 'bg-surface-variant hover:bg-surface-container'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-8 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">No requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className={`${TYPE_BG[req.help_type] ?? 'bg-surface-container'} border-4 border-black p-4 rounded-2xl`}>
              <div className="mb-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-headline font-black text-xl uppercase italic">{req.help_type}</span>
                  <span className={`border-2 px-2 py-0.5 font-headline font-black text-[10px] uppercase italic rounded-lg ${STATUS_STYLE[req.status]}`}>
                    {req.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="font-body font-bold text-sm">
                  {req.profiles?.full_name ?? 'Unknown'}
                  {req.profiles?.team_code && (
                    <span className="font-mono text-primary"> · {req.profiles.team_code}</span>
                  )}
                </p>
                <p className="font-body text-xs text-on-surface-variant">
                  {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {req.resolved_at && ` → ${new Date(req.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </p>
                {req.notes && (
                  <p className="font-body text-sm mt-2 bg-white/60 border border-black/10 px-3 py-2 rounded-xl">
                    {req.notes}
                  </p>
                )}
                {req.location_lat && (
                  <a
                    href={`https://maps.google.com/?q=${req.location_lat},${req.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-body font-bold text-xs text-primary underline underline-offset-2 mt-1"
                  >
                    📍 View Location
                  </a>
                )}
              </div>

              {req.status !== 'resolved' && (
                <div className="flex gap-2">
                  {req.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(req.id, 'in_progress')}
                      className="flex-1 bg-primary-container text-on-primary-container border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
                    >
                      → In Progress
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(req.id, 'resolved')}
                    className="flex-1 bg-surface border-2 border-black py-2 font-headline font-black text-xs uppercase italic drop-block rounded-xl active:scale-95"
                  >
                    ✓ Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
