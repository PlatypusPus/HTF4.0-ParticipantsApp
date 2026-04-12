import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CheckinMonitorScreen() {
  const [checkins, setCheckins] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadCheckins = useCallback(async () => {
    const { data, count } = await supabase
      .from('checkins')
      .select('*, profiles(full_name, team_name, team_code)', { count: 'exact' })
      .order('checked_in_at', { ascending: false })
    if (data) setCheckins(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCheckins()
    const ch = supabase
      .channel('admin_checkins_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkins' }, loadCheckins)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadCheckins])

  const filtered = search.trim()
    ? checkins.filter(c => {
        const q = search.toLowerCase()
        return (
          c.profiles?.full_name?.toLowerCase().includes(q) ||
          c.profiles?.team_code?.toLowerCase().includes(q) ||
          c.profiles?.team_name?.toLowerCase().includes(q)
        )
      })
    : checkins

  if (loading) return <div className="py-12"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-headline font-black text-3xl uppercase italic text-white">Check-ins</h1>
        <div className="bg-primary-container border-4 border-black px-4 py-2 drop-block rounded-2xl">
          <span className="font-headline font-black text-2xl text-on-primary-container">{total}</span>
          <span className="font-body font-bold text-xs text-on-primary-container opacity-80 ml-1">in</span>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or team..."
        className="w-full bg-white border-4 border-black px-4 py-3 font-body font-bold text-base focus:outline-none focus:border-primary rounded-xl mb-5"
      />

      {filtered.length === 0 ? (
        <div className="bg-surface-container border-4 border-black p-6 rounded-3xl text-center">
          <p className="font-body font-bold text-on-surface-variant">
            {search ? 'No matches found' : 'No one checked in yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, idx) => (
            <div key={item.id} className="bg-surface border-4 border-black px-4 py-3 rounded-2xl flex items-center gap-3">
              <span className="font-headline font-black text-lg text-outline w-7 flex-shrink-0 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-headline font-black text-base italic truncate">{item.profiles?.full_name ?? 'Unknown'}</p>
                <p className="font-body font-bold text-sm text-on-surface-variant">
                  {item.profiles?.team_name}
                  {item.profiles?.team_code && (
                    <span className="font-mono text-primary"> · {item.profiles.team_code}</span>
                  )}
                </p>
              </div>
              <p className="font-mono text-xs text-outline flex-shrink-0">
                {new Date(item.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
