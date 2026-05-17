import { supabase } from '../lib/supabase'
import { HeadContent, Link, Outlet, Scripts, createRootRoute, useNavigate, useLocation } from '@tanstack/react-router'
import { Hash, Home, MessageSquare, Mail, Settings, Trophy, User, Target, Menu, X, Users, Crown } from 'lucide-react'
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
      { title: 'neesh' },
    ],
    links: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
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

const PUBLIC_PATHS = ['/', '/signin', '/signup', '/login', '/terms', '/privacy', '/community-guidelines', '/refund-policy']
const AUTH_REDIRECT_PATHS = ['/', '/signin', '/signup', '/login']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isYesterday(date: Date, today: Date) {
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  return isSameDay(date, y)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function NavItem({ to, icon: Icon, label, onClick, badge }: { to: string; icon: React.ElementType; label: string; onClick?: () => void; badge?: number }) {
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

function AppShell() {
  const { user, ready, logout } = useIdentity()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadDms, setUnreadDms] = useState(0)

  const pathname = location.pathname
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (!user) return
    setPendingCount(0)
    setUnreadDms(0)
  }, [user])

  useEffect(() => {
    if (!user) return

    async function updateLoginStreak() {
      const today = new Date()
      const currentMonth = monthKey(today)

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('current_streak,longest_streak,last_login_streak_at,is_premium,is_founder_override,username,streak_freezes_remaining,streak_freezes_reset_month')
        .eq('id', user.id)
        .maybeSingle()

      if (error || !profile) {
        if (error) console.error('Streak load error:', error)
        return
      }

      const isPremium =
        profile.is_premium === true ||
        profile.is_founder_override === true ||
        profile.username === 'ceo'

      let freezesRemaining = profile.streak_freezes_remaining ?? 0
      let freezeMonth = profile.streak_freezes_reset_month ?? null

      if (isPremium && freezeMonth !== currentMonth) {
        freezesRemaining = 3
        freezeMonth = currentMonth
      }

      const currentStreak = profile.current_streak ?? 0
      const longestStreak = profile.longest_streak ?? 0
      const lastLogin = profile.last_login_streak_at ? new Date(profile.last_login_streak_at) : null

      let newStreak = currentStreak

      if (!lastLogin) {
        newStreak = 1
      } else if (isSameDay(lastLogin, today)) {
        newStreak = currentStreak
      } else if (isYesterday(lastLogin, today)) {
        newStreak = currentStreak + 1
      } else {
        const missedDays = Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)) - 1

        if (isPremium && missedDays > 0 && freezesRemaining >= missedDays) {
          freezesRemaining -= missedDays
          newStreak = currentStreak + 1
        } else {
          newStreak = 1
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(longestStreak, newStreak),
          last_login_streak_at: today.toISOString(),
          streak_freezes_remaining: freezesRemaining,
          streak_freezes_reset_month: freezeMonth,
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Streak update error:', updateError)
      }
    }

    updateLoginStreak()
  }, [user])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (isPublicPath) {
    if (user && AUTH_REDIRECT_PATHS.includes(pathname)) {
      return <NavigateTo to="/home" />
    }
    return <Outlet />
  }

  if (!user) return <NavigateTo to="/signin" />

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <button onClick={() => setMobileOpen(true)} className="md:hidden fixed top-3 left-3 z-40 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white">
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={closeMobile}>
          <aside className="w-56 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-5 border-b border-zinc-800 flex items-center justify-between">
              <img src="/neesh-logo.png" alt="neesh" className="h-24" />
              <button onClick={closeMobile} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <SidebarContent logout={logout} onNavClick={closeMobile} pendingFriendRequests={pendingCount} unreadMessages={unreadDms} />
          </aside>
        </div>
      )}

      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-zinc-800 flex-col">
        <div className="px-4 py-5 border-b border-zinc-800">
          <img src="/neesh-logo.png" alt="neesh" className="h-16" />
        </div>
        <SidebarContent logout={logout} pendingFriendRequests={pendingCount} unreadMessages={unreadDms} />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarContent({ logout, onNavClick, pendingFriendRequests, unreadMessages }: { logout: () => Promise<void>; onNavClick?: () => void; pendingFriendRequests?: number; unreadMessages?: number }) {
  return (
    <>
      <nav className="flex-1 p-3 space-y-1">
        <NavItem to="/home" icon={Home} label="Home" onClick={onNavClick} />
        <NavItem to="/chat" icon={Hash} label="Interest Chat" onClick={onNavClick} />
        <NavItem to="/community" icon={MessageSquare} label="Community" onClick={onNavClick} />
        <NavItem to="/messages" icon={Mail} label="Messages" onClick={onNavClick} badge={unreadMessages} />
        <NavItem to="/challenges" icon={Target} label="Challenges" onClick={onNavClick} />
        <NavItem to="/friends" icon={Users} label="Friends" onClick={onNavClick} badge={pendingFriendRequests} />
        <NavItem to="/leaderboard" icon={Trophy} label="Leaderboard" onClick={onNavClick} />
        <div className="my-2 border-t border-zinc-800/50" />
        <NavItem to="/premium-chat" icon={Crown} label="NEESH.+ Chat" onClick={onNavClick} />
      </nav>
      <div className="p-3 border-t border-zinc-800 space-y-1">
        <NavItem to="/profile" icon={User} label="Profile" onClick={onNavClick} />
        <NavItem to="/premium" icon={Crown} label="NEESH.+" onClick={onNavClick} />
        <NavItem to="/settings" icon={Settings} label="Settings" onClick={onNavClick} />
        <button onClick={() => { logout(); onNavClick?.() }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors text-left">
          Sign out
        </button>
      </div>
      <div className="px-4 py-3 border-t border-zinc-800 flex flex-wrap gap-x-3 gap-y-1">
        <Link to="/terms" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Terms</Link>
        <Link to="/privacy" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</Link>
        <Link to="/refund-policy" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Refund Policy</Link>
        <Link to="/community-guidelines" onClick={onNavClick} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Guidelines</Link>
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
