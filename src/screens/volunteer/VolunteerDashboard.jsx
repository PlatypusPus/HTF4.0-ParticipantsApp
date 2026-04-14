import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function VolunteerDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [
      { count: checkins },
      { count: queueLen },
      { count: pendingHelp },
      { count: flagged },
      { count: mealsToday },
    ] = await Promise.all([
      supabase.from('checkins').select('*', { count: 'exact', head: true }),
      supabase.from('song_queue').select('*', { count: 'exact', head: true }).eq('is_played', false),
      supabase.from('help_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('media_items').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
      supabase.from('meal_records').select('*', { count: 'exact', head: true }).eq('meal_date', today),
    ])
    setStats({ checkins, queueLen, pendingHelp, flagged, mealsToday })
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
    const tables = ['checkins', 'song_queue', 'help_requests', 'media_items', 'meal_records']
    const channels = tables.map(t =>
      supabase.channel(`volunteer_stats_${t}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, loadStats)
        .subscribe()
    )
    return () => channels.forEach(ch => supabase.removeChannel(ch))
  }, [loadStats])

  const CARDS = [
    { key: 'checkins',    label: 'Checked In',     icon: '✓', bg: 'bg-primary-container',  text: 'text-on-primary-container',  alert: false },
    { key: 'mealsToday',  label: 'Meals Served',   icon: '🍽', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', alert: false },
    { key: 'queueLen',    label: 'Songs in Queue', icon: '♫', bg: 'bg-surface-variant',    text: 'text-on-surface',            alert: false },
    { key: 'pendingHelp', label: 'Pending Help',   icon: '!', bg: null, text: null, alert: true  },
    { key: 'flagged',     label: 'Flagged Media',  icon: '⚑', bg: null, text: null, alert: true  },
  ]

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div>
      <h1 className="font-headline font-black text-3xl uppercase italic mb-6 text-white">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {CARDS.map(c => {
          const val = stats?.[c.key] ?? 0
          const alert = c.alert && val > 0
          const bg = alert ? 'bg-error-container' : (c.bg ?? 'bg-surface-variant')
          const text = alert ? 'text-on-error-container' : (c.text ?? 'text-on-surface')
          return (
            <div key={c.key} className={`${bg} ${text} border-4 border-black p-5 drop-block rounded-3xl`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="font-headline font-black text-4xl">{val}</div>
              <div className="font-body font-bold text-xs opacity-80 mt-1 leading-tight">{c.label}</div>
            </div>
          )
        })}
      </div>

      <div className="bg-surface border-4 border-black p-5 drop-block rounded-3xl">
        <h2 className="font-headline font-black text-lg uppercase italic mb-2 text-black">Quick Notes</h2>
        <ul className="font-body font-bold text-sm text-on-surface-variant space-y-1">
          <li>• <span className="text-error">Red</span> stat cards require immediate attention</li>
          <li>• Counts update in real-time across every logged-in volunteer</li>
        </ul>
      </div>
    </div>
  )
}
