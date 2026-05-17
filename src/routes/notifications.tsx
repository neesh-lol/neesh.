import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Bell, Mail, UserPlus, Users, CheckCircle, Trash2, CheckCheck } from 'lucide-react'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})

type NotificationRow = {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

function iconForType(type: string) {
  if (type === 'direct_message') return Mail
  if (type === 'friend_request') return UserPlus
  if (type === 'friend_accepted') return Users
  return Bell
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function NotificationsPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const loadNotifications = async () => {
    if (!user) return

    setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Notifications load error:', error)
      setNotifications([])
      setLoading(false)
      return
    }

    setNotifications(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return

    loadNotifications()

    const channel = supabase
      .channel(`notifications_page_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markOneRead = async (notification: NotificationRow) => {
    if (!user) return

    if (!notification.read_at) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
        .eq('user_id', user.id)
    }

    if (notification.link) {
      navigate({ to: notification.link as any })
    } else {
      await loadNotifications()
    }
  }

  const markAllRead = async () => {
    if (!user) return

    setActionLoading(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (error) {
      console.error('Mark all notifications read error:', error)
    }

    await loadNotifications()
    setActionLoading(false)
  }

  const deleteNotification = async (id: string) => {
    if (!user) return

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete notification error:', error)
      return
    }

    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const clearAll = async () => {
    if (!user) return
    if (!confirm('Clear all notifications?')) return

    setActionLoading(true)

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Clear notifications error:', error)
    }

    setNotifications([])
    setActionLoading(false)
  }

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell size={16} />
            Notifications
          </h1>
          <p className="text-xs text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-red-400 hover:border-zinc-700 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 px-5">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Bell size={22} className="text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-white mb-1">No notifications yet</p>
            <p className="text-xs text-zinc-500">
              Friend requests and messages will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {notifications.map((notification) => {
              const Icon = iconForType(notification.type)
              const unread = !notification.read_at

              return (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-3 px-5 py-4 transition-colors ${
                    unread ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/30'
                  }`}
                >
                  <button
                    onClick={() => markOneRead(notification)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'direct_message'
                          ? 'bg-blue-500/10 text-blue-400'
                          : notification.type === 'friend_request'
                            ? 'bg-purple-500/10 text-purple-400'
                            : notification.type === 'friend_accepted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>

                        {unread && (
                          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                      </div>

                      {notification.body && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                      )}

                      <p className="text-[11px] text-zinc-600 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 transition-all"
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
