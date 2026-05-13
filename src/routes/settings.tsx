import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useState } from 'react'
import { Bell, Moon, Shield, LogOut, Crown, ExternalLink, BadgeCheck } from 'lucide-react'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? 'bg-emerald-500' : 'bg-zinc-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingsRow({ icon: Icon, label, description, children }: {
  icon: React.ElementType
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-zinc-800/50">
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-zinc-500 flex-shrink-0" />
        <div>
          <p className="text-sm text-white">{label}</p>
          {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

interface SubStatus {
  isPremium: boolean
  isFounder: boolean
  premiumSince: string | null
  premiumExpires: string | null
  hasStripeSubscription: boolean
}

function SettingsPage() {
  const { user, ready, logout } = useIdentity()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

  useEffect(() => {
    if (!user) return
    fetch('/api/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSubStatus(d) })
      .catch(() => {})
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/signin' })
  }

  const handleManageSub = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-portal' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setActionLoading(false)
    }
  }

  if (!ready || !user) return null

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white">Settings</h1>
        <p className="text-xs text-zinc-500">Manage your account and preferences</p>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 py-6">
        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">Account</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 mb-6">
          <div className="py-4 border-b border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-0.5">Email</p>
            <p className="text-sm text-white">{user.email}</p>
          </div>
          <div className="py-4">
            <p className="text-xs text-zinc-500 mb-0.5">Display name</p>
            <p className="text-sm text-white">{user.name || '—'}</p>
          </div>
        </div>

        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">NEESH.+</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 mb-6">
          <div className="py-4 border-b border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown size={16} className={subStatus?.isPremium ? 'text-yellow-400' : 'text-zinc-500'} />
                <div>
                  <p className="text-sm text-white">Premium Status</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {subStatus?.isFounder
                      ? 'Founder — Lifetime access'
                      : subStatus?.isPremium
                        ? `Active${subStatus.premiumExpires ? ` · Renews ${new Date(subStatus.premiumExpires).toLocaleDateString()}` : ''}`
                        : 'Not subscribed'}
                  </p>
                </div>
              </div>
              {subStatus?.isPremium && (
                <BadgeCheck size={16} className="text-emerald-400" />
              )}
            </div>
          </div>
          <div className="py-4">
            {subStatus?.isPremium && !subStatus.isFounder && subStatus.hasStripeSubscription ? (
              <button
                onClick={handleManageSub}
                disabled={actionLoading}
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <ExternalLink size={14} />
                {actionLoading ? 'Loading…' : 'Manage subscription'}
              </button>
            ) : subStatus?.isFounder ? (
              <p className="text-xs text-zinc-500">Founder accounts have permanent premium access</p>
            ) : (
              <button
                onClick={() => navigate({ to: '/premium' })}
                className="flex items-center gap-2 text-sm text-white hover:text-zinc-300 transition-colors"
              >
                <Crown size={14} className="text-yellow-400" />
                Upgrade to NEESH.+
              </button>
            )}
          </div>
        </div>

        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">Preferences</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 mb-6">
          <SettingsRow icon={Bell} label="Notifications" description="Message alerts and activity">
            <Toggle checked={notifications} onChange={setNotifications} />
          </SettingsRow>
          <SettingsRow icon={Moon} label="Dark mode" description="Always-on dark theme">
            <Toggle checked={darkMode} onChange={setDarkMode} />
          </SettingsRow>
        </div>

        <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-3">Privacy</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 mb-6">
          <SettingsRow
            icon={Shield}
            label="Profile visibility"
            description="Your profile appears on the leaderboard"
          >
            <span className="text-xs text-zinc-500">Public</span>
          </SettingsRow>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )
}
