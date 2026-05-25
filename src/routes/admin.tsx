import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import {
  Shield,
  Flag,
  Trash2,
  CheckCircle,
  Crown,
  XCircle,
  Ban,
  RefreshCcw,
  AlertTriangle,
  Users,
  MessageSquare,
  Bell,
} from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

type ReportRow = {
  id: string
  reporter_id: string | null
  reported_user_id: string | null
  message_type: string | null
  message_id: string | null
  reason: string | null
  message_content: string | null
  status: string | null
  created_at: string
}

type ProfileMap = Record<
  string,
  {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    is_premium: boolean | null
    is_founder_override: boolean | null
  }
>

type AdminStats = {
  totalUsers: number
  premiumUsers: number
  openReports: number
  totalReports: number
  communityMessages: number
  notificationsToday: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tableForMessageType(type: string | null) {
  if (type === 'community') return 'community_messages'
  if (type === 'chat') return 'chat_messages'
  if (type === 'premium') return 'premium_messages'
  if (type === 'weekly_match') return 'weekly_match_messages'
  return null
}

function AdminPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [isOwner, setIsOwner] = useState<boolean | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [profiles, setProfiles] = useState<ProfileMap>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [filter, setFilter] = useState<'open' | 'dismissed' | 'resolved' | 'all'>('open')
  const [msg, setMsg] = useState('')
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function checkOwner() {
      const { data, error } = await supabase
        .from('profiles')
        .select('username,is_founder_override')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Admin owner check error:', error)
        setIsOwner(false)
        return
      }

      setIsOwner(data?.username === 'ceo' || data?.is_founder_override === true)
    }

    checkOwner()
  }, [user])

  const loadStats = async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [
        totalUsersRes,
        premiumUsersRes,
        openReportsRes,
        totalReportsRes,
        communityMessagesRes,
        notificationsTodayRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
        supabase.from('message_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('message_reports').select('*', { count: 'exact', head: true }),
        supabase.from('community_messages').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).gte('created_at', since),
      ])

      setStats({
        totalUsers: totalUsersRes.count ?? 0,
        premiumUsers: premiumUsersRes.count ?? 0,
        openReports: openReportsRes.count ?? 0,
        totalReports: totalReportsRes.count ?? 0,
        communityMessages: communityMessagesRes.count ?? 0,
        notificationsToday: notificationsTodayRes.count ?? 0,
      })
    } catch (error) {
      console.error('Admin stats load error:', error)
    }
  }

  const loadReports = async () => {
    if (!user) return

    setLoading(true)
    setMsg('')
    await loadStats()

    let query = supabase
      .from('message_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Admin reports load error:', error)
      setReports([])
      setLoading(false)
      setMsg(`Failed to load reports: ${error.message}`)
      return
    }

    const rows = data ?? []
    setReports(rows)

    const ids = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.reporter_id, r.reported_user_id])
          .filter(Boolean) as string[]
      )
    )

    if (ids.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
        .in('id', ids)

      if (profileError) {
        console.error('Admin profile map load error:', profileError)
      } else {
        const map: ProfileMap = {}

        for (const p of profileRows ?? []) {
          map[p.id] = p
        }

        setProfiles(map)
      }
    } else {
      setProfiles({})
    }

    setLoading(false)
  }

  useEffect(() => {
    if (isOwner) {
      loadReports()
    }
  }, [isOwner, filter])

  useEffect(() => {
    if (!user || !isOwner) return

    const channel = supabase
      .channel(`admin_reports_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reports',
        },
        () => {
          loadReports()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, isOwner, filter])

  const updateProfileInState = (userId: string, changes: Partial<ProfileMap[string]>) => {
    setProfiles((prev) => {
      const current = prev[userId]
      if (!current) return prev

      return {
        ...prev,
        [userId]: {
          ...current,
          ...changes,
        },
      }
    })
  }

  const setReportStatus = async (reportId: string, status: string) => {
    setActionLoading(reportId)
    setMsg('')

    const { error } = await supabase
      .from('message_reports')
      .update({ status })
      .eq('id', reportId)

    if (error) {
      console.error('Report status update error:', error)
      setMsg(`Failed: ${error.message}`)
    } else {
      setMsg(status === 'dismissed' ? 'Report dismissed.' : `Report marked ${status}.`)
      await loadReports()
    }

    setActionLoading('')
  }

  const deleteReportedMessage = async (report: ReportRow) => {
    if (!report.message_id) return

    const table = tableForMessageType(report.message_type)

    if (!table) {
      alert('Unknown message type. Could not delete message.')
      return
    }

    if (!confirm('Delete this reported message?')) return

    setActionLoading(report.id)
    setMsg('')

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', String(report.message_id))

    if (error) {
      console.error('Delete reported message error:', error)
      setMsg(`Failed to delete message: ${error.message}`)
      setActionLoading('')
      return
    }

    await supabase
      .from('message_reports')
      .update({ status: 'resolved' })
      .eq('id', report.id)

    setMsg('Message deleted and report resolved.')
    await loadReports()
    setActionLoading('')
  }

  const grantPremium = async (userId: string | null) => {
    if (!userId) return

    setActionLoading(userId)
    setMsg('')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_premium: true,
      })
      .eq('id', userId)
      .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
      .maybeSingle()

    if (error) {
      console.error('Grant premium error:', error)
      setMsg(`Failed to grant NEESH.+: ${error.message}`)
    } else {
      updateProfileInState(userId, {
        is_premium: data?.is_premium ?? true,
        is_founder_override: data?.is_founder_override ?? profiles[userId]?.is_founder_override ?? false,
      })

      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: user?.id ?? null,
        type: 'premium',
        title: 'NEESH.+ Granted',
        body: 'Your account now has NEESH.+ access.',
        link: '/premium',
      })

      setMsg('NEESH.+ granted and saved.')
      await loadStats()
    }

    setActionLoading('')
  }

  const revokePremium = async (userId: string | null) => {
    if (!userId) return

    const target = profiles[userId]

    if (target?.username === 'ceo') {
      setMsg('Founder NEESH.+ cannot be revoked.')
      return
    }

    if (!confirm('Revoke NEESH.+ from this user?')) return

    setActionLoading(userId)
    setMsg('')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_premium: false,
        is_founder_override: false,
      })
      .eq('id', userId)
      .select('id,username,display_name,avatar_url,is_premium,is_founder_override')
      .maybeSingle()

    if (error) {
      console.error('Revoke premium error:', error)
      setMsg(`Failed to revoke NEESH.+: ${error.message}`)
    } else {
      updateProfileInState(userId, {
        is_premium: data?.is_premium ?? false,
        is_founder_override: data?.is_founder_override ?? false,
      })

      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: user?.id ?? null,
        type: 'premium',
        title: 'NEESH.+ Revoked',
        body: 'Your NEESH.+ access was removed.',
        link: '/premium',
      })

      setMsg('NEESH.+ revoked and saved.')
      await loadStats()
    }

    setActionLoading('')
  }

  const banUser = async (userId: string | null) => {
    if (!userId) return

    const target = profiles[userId]

    if (target?.username === 'ceo') {
      setMsg('You cannot ban the founder account.')
      return
    }

    const reason = prompt('Ban reason:')
    if (reason === null) return

    setActionLoading(userId)
    setMsg('')

    const { error } = await supabase
      .from('user_bans')
      .upsert(
        {
          user_id: userId,
          reason: reason.trim() || 'Banned by admin',
          banned_by: user?.id ?? null,
          active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (error) {
      console.error('Ban user error:', error)
      setMsg(`Ban failed: ${error.message}`)
    } else {
      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: user?.id ?? null,
        type: 'report',
        title: 'Account banned',
        body: reason.trim() || 'Your account was banned by an admin.',
        link: '/banned',
      })

      setMsg('User banned. They will be redirected to the banned page.')
    }

    setActionLoading('')
  }

  if (!ready || !user || isOwner === null) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 px-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Shield size={24} className="text-zinc-600" />
        </div>
        <h1 className="text-lg font-semibold text-white mb-1">Admin only</h1>
        <p className="text-sm text-zinc-500 max-w-xs">
          You do not have permission to view this page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={16} className="text-yellow-400" />
            Admin Dashboard
          </h1>
          <p className="text-xs text-zinc-500">Review reports and moderate NEESH.</p>
        </div>

        <button
          onClick={loadReports}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 px-5 py-4 border-b border-zinc-900">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <Users size={15} className="text-blue-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">Users</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <Crown size={15} className="text-yellow-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.premiumUsers.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">NEESH.+</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <Flag size={15} className="text-red-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.openReports.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">Open Reports</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <Shield size={15} className="text-purple-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.totalReports.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">All Reports</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <MessageSquare size={15} className="text-emerald-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.communityMessages.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">Community Msgs</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <Bell size={15} className="text-cyan-400 mb-2" />
            <p className="text-lg font-bold text-white">{stats.notificationsToday.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-500">Notifs 24h</p>
          </div>
        </div>
      )}

      <div className="px-5 py-4 border-b border-zinc-900 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('open')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'open' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          Open
        </button>

        <button
          onClick={() => setFilter('resolved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'resolved' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          Resolved
        </button>

        <button
          onClick={() => setFilter('dismissed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'dismissed' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          Dismissed
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          All
        </button>
      </div>

      {msg && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
          {msg}
        </div>
      )}

      <div className="flex-1 px-5 py-4">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Flag size={22} className="text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-white mb-1">No reports</p>
            <p className="text-xs text-zinc-500">Reported messages will show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const reporter = report.reporter_id ? profiles[report.reporter_id] : null
              const reported = report.reported_user_id ? profiles[report.reported_user_id] : null

              const reportedName = reported?.username
                ? `@${reported.username}`
                : reported?.display_name ?? 'Unknown user'

              const reporterName = reporter?.username
                ? `@${reporter.username}`
                : reporter?.display_name ?? 'Unknown reporter'

              return (
                <div
                  key={report.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Flag size={15} className="text-red-400" />
                        <p className="text-sm font-semibold text-white">
                          Reported message
                        </p>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            report.status === 'open'
                              ? 'border-red-500/30 text-red-400 bg-red-500/10'
                              : report.status === 'resolved'
                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                : 'border-zinc-700 text-zinc-500 bg-zinc-800'
                          }`}
                        >
                          {report.status ?? 'open'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-500">
                        {formatDate(report.created_at)} · {report.message_type ?? 'unknown'}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setReportStatus(
                          report.id,
                          report.status === 'dismissed' ? 'open' : 'dismissed'
                        )
                      }
                      disabled={actionLoading === report.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {report.status === 'dismissed' ? 'Reopen' : 'Dismiss'}
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                        Reported user
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white">{reportedName}</p>
                        {reported?.is_premium && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                            <Crown size={10} />
                            NEESH.+
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                        Reporter
                      </p>
                      <p className="text-sm text-white">{reporterName}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                      Reason
                    </p>
                    <p className="text-sm text-zinc-300">
                      {report.reason || 'No reason provided'}
                    </p>
                  </div>

                  <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                      Message content
                    </p>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                      {report.message_content || 'No message content saved.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => deleteReportedMessage(report)}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Delete message
                    </button>

                    <button
                      onClick={() => setReportStatus(report.id, 'resolved')}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      Mark resolved
                    </button>

                    <button
                      onClick={() => grantPremium(report.reported_user_id)}
                      disabled={!report.reported_user_id || actionLoading === report.reported_user_id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                    >
                      <Crown size={14} />
                      Grant NEESH.+
                    </button>

                    <button
                      onClick={() => revokePremium(report.reported_user_id)}
                      disabled={!report.reported_user_id || actionLoading === report.reported_user_id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium hover:text-white transition-colors disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Revoke NEESH.+
                    </button>

                    <button
                      onClick={() => banUser(report.reported_user_id)}
                      disabled={!report.reported_user_id || actionLoading === report.reported_user_id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Ban size={14} />
                      Ban user
                    </button>
                  </div>

                  {report.message_type === 'dm' && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                      <AlertTriangle size={14} />
                      DM message deletion may need a direct_messages mapping later.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
