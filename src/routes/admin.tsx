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
  const [filter, setFilter] = useState<'open' | 'dismissed' | 'all'>('open')
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
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
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
      setMsg(status === 'dismissed' ? 'Report dismissed.' : 'Report updated.')
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
  }  const revokePremium = async (userId: string | null) => {
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
