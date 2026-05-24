import { HeadContent, Link, Outlet, Scripts, createRootRoute, useNavigate, useLocation } from '@tanstack/react-router'
import { Hash, Home, MessageSquare, Mail, Settings, Trophy, User, Target, Menu, X, Users, Crown, Bell, Music2, Sparkles } from 'lucide-react'
import { IdentityProvider, useIdentity } from '../lib/identity-context'
import { CallbackHandler } from '../components/CallbackHandler'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },

      {
        title: 'neesh. | Meet People Who Share Your Interests',
      },
      {
        name: 'description',
        content:
          'Join interest-based communities, chat with like-minded people, make friends, and discover new conversations on neesh.',
      },

      {
        property: 'og:title',
        content: 'neesh. | Meet People Who Share Your Interests',
      },
      {
        property: 'og:description',
        content:
          'Join interest-based communities, chat with like-minded people, make friends, and discover new conversations on neesh.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://neesh.lol',
      },

      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'neesh. | Meet People Who Share Your Interests',
      },
      {
        name: 'twitter:description',
        content:
          'Join interest-based communities, chat with like-minded people, make friends, and discover new conversations on neesh.',
      },
    ],
    links: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'canonical', href: 'https://neesh.lol' },
    ],
  }),
  shellComponent: RootDocument,
  component: AppShell,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <IdentityProvider>
          <CallbackHandler>{children}</CallbackHandler>
        </IdentityProvider>
        <Scripts />
      </body>
    </html>
  )
}

const PUBLIC_PATHS = [
  '/',
  '/signin',
  '/signup',
  '/login',
  '/terms',
  '/privacy',
  '/community-guidelines',
  '/refund-policy',
  '/banned',
]

const AUTH_REDIRECT_PATHS = ['/', '/signin', '/signup', '/login']

type ToastKind = 'message' | 'friend' | 'success' | 'notification'

type AppToast = {
  id: string
  kind: ToastKind
  title: string
  body: string
  to?: string
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysBetween(a: Date, b: Date) {
  const oneDay = 1000 * 60 * 60 * 24
  const startA = startOfLocalDay(a).getTime()
  const startB = startOfLocalDay(b).getTime()
  return Math.floor((startB - startA) / oneDay)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function NavItem({
  to,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  to: string
  icon: React.ElementType
  label: string
  onClick?: () => void
  badge?: number
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors [&.active]:text-white [&.active]:bg-zinc-800"
    >
      <Icon size={18} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-[badge-in_0.2s_ease-out]">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

function ToastStack({
  toasts,
  onClose,
  onOpen,
}: {
  toasts: AppToast[]
  onClose: (id: string) => void
  onOpen: (toast: AppToast) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 bottom-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => onOpen(toast)}
          className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-4 py-3 hover:border-zinc-500 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                toast.kind === 'message'
                  ? 'bg-blue-500/10 text-blue-400'
                  : toast.kind === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : toast.kind === 'friend'
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-zinc-500/10 text-zinc-300'
              }`}
            >
              {toast.kind === 'message' ? (
                <Mail size={16} />
              ) : toast.kind === 'success' ? (
                <Users size={16} />
              ) : toast.kind === 'friend' ? (
                <User size={16} />
              ) : (
                <Bell size={16} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{toast.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5 overflow-hidden">{toast.body}</p>
            </div>

            <span
              onClick={(e) => {
                e.stopPropagation()
                onClose(toast.id)
              }}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <X size={14} />
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function AppShell() {
  const { user, ready, logout } = useIdentity()
  const location = useLocation()
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadDms, setUnreadDms] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [toasts, setToasts] = useState<AppToast[]>([])
  const [banChecked, setBanChecked] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(true)

  const pathname = location.pathname
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const pushToast = (toast: Omit<AppToast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4))

    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }

  const openToast = (toast: AppToast) => {
    removeToast(toast.id)

    if (toast.to) {
      navigate({ to: toast.to as any })
    }
  }

  useEffect(() => {
    if (!ready) return

    if (!user) {
      setBanChecked(true)
      setIsBanned(false)
      return
    }

    async function checkBan() {
      const { data, error } = await supabase
        .from('user_bans')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (error) {
        console.error('Ban check error:', error)
        setIsBanned(false)
        setBanChecked(true)
        return
      }

      const banned = !!data
      setIsBanned(banned)
      setBanChecked(true)

      if (banned && pathname !== '/banned') {
        navigate({ to: '/banned', replace: true })
      }
    }

    setBanChecked(false)
    checkBan()
  }, [ready, user, pathname, navigate])

  useEffect(() => {
    if (!ready) return

    if (!user) {
      setOnboardingCompleted(true)
      setOnboardingChecked(true)
      return
    }

    if (isBanned) {
      setOnboardingCompleted(true)
      setOnboardingChecked(true)
      return
    }

    async function checkOnboarding() {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Onboarding check error:', error)
        setOnboardingCompleted(true)
        setOnboardingChecked(true)
        return
      }

      setOnboardingCompleted(data?.onboarding_completed === true)
      setOnboardingChecked(true)
    }

    setOnboardingChecked(false)
    checkOnboarding()
  }, [ready, user, isBanned, pathname])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`root_ban_check_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_bans',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('user_bans')
            .select('id')
            .eq('user_id', user.id)
            .eq('active', true)
            .maybeSingle()

          const banned = !!data
          setIsBanned(banned)

          if (banned) {
            navigate({ to: '/banned', replace: true })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, navigate])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`root_onboarding_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', user.id)
            .maybeSingle()

          setOnboardingCompleted(data?.onboarding_completed === true)
          setOnboardingChecked(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!user || isBanned) return

    const markOnline = async () => {
      const now = new Date().toISOString()

      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: 'online',
        last_seen: now,
        updated_at: now,
      })

      await supabase
        .from('profiles')
        .update({ last_seen_at: now })
        .eq('id', user.id)
    }

    const markOffline = async () => {
      const now = new Date().toISOString()

      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: 'offline',
        last_seen: now,
        updated_at: now,
      })

      await supabase
        .from('profiles')
        .update({ last_seen_at: now })
        .eq('id', user.id)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markOnline()
      } else {
        markOffline()
      }
    }

    markOnline()

    const interval = setInterval(markOnline, 30000)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', markOffline)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', markOffline)
      markOffline()
    }
  }, [user, isBanned])

  useEffect(() => {
    if (!user || isBanned) return

    const loadNotificationCounts = async () => {
      try {
        const { count: pendingFriends } = await supabase
          .from('friendships')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('status', 'pending')

        setPendingCount(pendingFriends ?? 0)

        const { count: unreadMessages } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .is('read_at', null)

        setUnreadDms(unreadMessages ?? 0)

        const { count: unreadNotifs } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null)

        setUnreadNotifications(unreadNotifs ?? 0)
      } catch (error) {
        console.error('Notification count load error:', error)
      }
    }

    const getProfileLabel = async (profileId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('username,display_name')
        .eq('id', profileId)
        .maybeSingle()

      if (!data) return 'Someone'

      return data.username ? `@${data.username}` : data.display_name ?? 'Someone'
    }

    const saveNotification = async ({
      userId,
      actorId,
      type,
      title,
      body,
      link,
    }: {
      userId: string
      actorId?: string | null
      type: string
      title: string
      body: string
      link: string
    }) => {
      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: actorId ?? null,
        type,
        title,
        body,
        link,
      })
    }

    loadNotificationCounts()

    const interval = setInterval(loadNotificationCounts, 10000)

    const channel = supabase
      .channel(`root_notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        async (payload: any) => {
          loadNotificationCounts()

          const row = payload.new
          const oldRow = payload.old

          if (!row) return

          if (
            payload.eventType === 'INSERT' &&
            row.receiver_id === user.id &&
            row.status === 'pending'
          ) {
            const name = await getProfileLabel(row.requester_id)
            const title = 'New friend request'
            const body = `${name} sent you a friend request.`

            pushToast({
              kind: 'friend',
              title,
              body,
              to: '/friends',
            })

            await saveNotification({
              userId: user.id,
              actorId: row.requester_id,
              type: 'friend_request',
              title,
              body,
              link: '/friends',
            })

            loadNotificationCounts()
          }

          if (
            payload.eventType === 'UPDATE' &&
            row.requester_id === user.id &&
            row.status === 'accepted' &&
            oldRow?.status !== 'accepted'
          ) {
            const name = await getProfileLabel(row.receiver_id)
            const title = 'Friend request accepted'
            const body = `${name} accepted your friend request.`

            pushToast({
              kind: 'success',
              title,
              body,
              to: '/friends',
            })

            await saveNotification({
              userId: user.id,
              actorId: row.receiver_id,
              type: 'friend_accepted',
              title,
              body,
              link: '/friends',
            })

            loadNotificationCounts()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload: any) => {
          loadNotificationCounts()

          const row = payload.new

          if (
            payload.eventType === 'INSERT' &&
            row?.receiver_id === user.id &&
            row?.sender_id !== user.id
          ) {
            const name = await getProfileLabel(row.sender_id)
            const title = `New message from ${name}`
            const body = row.content ?? 'Sent you a message.'

            pushToast({
              kind: 'message',
              title,
              body,
              to: '/messages',
            })

            await saveNotification({
              userId: user.id,
              actorId: row.sender_id,
              type: 'direct_message',
              title,
              body,
              link: '/messages',
            })

            loadNotificationCounts()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotificationCounts()
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user, isBanned])

  useEffect(() => {
    if (!user || isBanned) return

    async function updateLoginStreak() {
      const today = new Date()
      const thisMonth = monthKey(today)

      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'current_streak,longest_streak,last_login_streak_at,is_premium,is_founder_override,username,streak_freezes_remaining,streak_freezes_reset_month'
        )
        .eq('id', user.id)
        .maybeSingle()

      if (error || !profile) {
        if (error) console.error('Streak load error:', error)
        return
      }

      const hasPremium =
        profile.is_premium === true ||
        profile.is_founder_override === true ||
        profile.username === 'ceo'

      let freezesRemaining = profile.streak_freezes_remaining ?? 0
      let resetMonth = profile.streak_freezes_reset_month ?? null

      if (hasPremium && resetMonth !== thisMonth) {
        freezesRemaining = 3
        resetMonth = thisMonth
      }

      const currentStreak = profile.current_streak ?? 0
      const longestStreak = profile.longest_streak ?? 0
      const lastLogin = profile.last_login_streak_at
        ? new Date(profile.last_login_streak_at)
        : null

      let newStreak = currentStreak

      if (!lastLogin) {
        newStreak = 1
      } else {
        const dayDiff = daysBetween(lastLogin, today)

        if (dayDiff <= 0) {
          newStreak = currentStreak
        } else if (dayDiff === 1) {
          newStreak = currentStreak + 1
        } else {
          const missedDays = dayDiff - 1

          if (hasPremium && freezesRemaining >= missedDays) {
            freezesRemaining -= missedDays
            newStreak = currentStreak + 1
          } else {
            newStreak = 1
          }
        }
      }

      await supabase
        .from('profiles')
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(longestStreak, newStreak),
          last_login_streak_at: today.toISOString(),
          streak_freezes_remaining: freezesRemaining,
          streak_freezes_reset_month: resetMonth,
        })
        .eq('id', user.id)
    }

    updateLoginStreak()
  }, [user, isBanned])

  if (!ready || !banChecked || !onboardingChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (user && isBanned && pathname !== '/banned') {
    return <NavigateTo to="/banned" />
  }

  if (isPublicPath) {
    if (user && AUTH_REDIRECT_PATHS.includes(pathname) && !isBanned) {
      return <NavigateTo to={onboardingCompleted ? '/home' : '/onboarding'} />
    }

    return <Outlet />
  }

  if (!user) return <NavigateTo to="/signin" />

  if (isBanned) return <NavigateTo to="/banned" />

  if (!onboardingCompleted && pathname !== '/onboarding') {
    return <NavigateTo to="/onboarding" />
  }

  if (onboardingCompleted && pathname === '/onboarding') {
    return <NavigateTo to="/home" />
  }

  if (pathname === '/onboarding') {
    return <Outlet />
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <ToastStack toasts={toasts} onClose={removeToast} onOpen={openToast} />

      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={closeMobile}>
          <aside
            className="w-56 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-5 border-b border-zinc-800 flex items-center justify-between">
              <img src="/neesh-logo.png" alt="neesh" className="h-24" />
              <button onClick={closeMobile} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <SidebarContent
              logout={logout}
              onNavClick={closeMobile}
              pendingFriendRequests={pendingCount}
              unreadMessages={unreadDms}
              unreadNotifications={unreadNotifications}
            />
          </aside>
        </div>
      )}

      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-zinc-800 flex-col">
        <div className="px-4 py-5 border-b border-zinc-800">
          <img src="/neesh-logo.png" alt="neesh" className="h-16" />
        </div>
        <SidebarContent
          logout={logout}
          pendingFriendRequests={pendingCount}
          unreadMessages={unreadDms}
          unreadNotifications={unreadNotifications}
        />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarContent({
  logout,
  onNavClick,
  pendingFriendRequests,
  unreadMessages,
  unreadNotifications,
}: {
  logout: () => Promise<void>
  onNavClick?: () => void
  pendingFriendRequests?: number
  unreadMessages?: number
  unreadNotifications?: number
}) {
  return (
    <>
      <nav className="flex-1 p-3 space-y-1">
        <NavItem to="/home" icon={Home} label="Home" onClick={onNavClick} />
        <NavItem to="/find-people" icon={Sparkles} label="Find People" onClick={onNavClick} />
        <NavItem to="/chat" icon={Hash} label="Interest Chat" onClick={onNavClick} />
        <NavItem to="/community" icon={MessageSquare} label="Community" onClick={onNavClick} />
        <NavItem to="/messages" icon={Mail} label="Messages" onClick={onNavClick} badge={unreadMessages} />
        <NavItem to="/notifications" icon={Bell} label="Notifications" onClick={onNavClick} badge={unreadNotifications} />
        <NavItem to="/challenges" icon={Target} label="Challenges" onClick={onNavClick} />
        <NavItem to="/songwars" icon={Music2} label="Song Wars" onClick={onNavClick} />
        <NavItem to="/friends" icon={Users} label="Friends" onClick={onNavClick} badge={pendingFriendRequests} />
        <NavItem to="/leaderboard" icon={Trophy} label="Leaderboard" onClick={onNavClick} />

        <div className="my-2 border-t border-zinc-800/50" />

        <NavItem to="/premium-chat" icon={Crown} label="NEESH.+ Chat" onClick={onNavClick} />
      </nav>

      <div className="p-3 border-t border-zinc-800 space-y-1">
        <NavItem to="/profile" icon={User} label="Profile" onClick={onNavClick} />
        <NavItem to="/premium" icon={Crown} label="NEESH.+" onClick={onNavClick} />
        <NavItem to="/settings" icon={Settings} label="Settings" onClick={onNavClick} />

        <button
          onClick={() => {
            logout()
            onNavClick?.()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors text-left"
        >
          Sign out
        </button>
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 flex flex-wrap gap-x-3 gap-y-1">
        <Link to="/terms" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Terms
        </Link>
        <Link to="/privacy" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Privacy
        </Link>
        <Link to="/refund-policy" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Refund Policy
        </Link>
        <Link to="/community-guidelines" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Guidelines
        </Link>
      </div>
    </>
  )
}

function NavigateTo({ to }: { to: string }) {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to, replace: true })
  }, [to, navigate])

  return null
}
