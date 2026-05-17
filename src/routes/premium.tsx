import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Crown,
  Shield,
  Eye,
  MessageSquare,
  Palette,
  Star,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react'

export const Route = createFileRoute('/premium')({
  component: PremiumPage,
  validateSearch: (search: Record<string, unknown>) => ({
    success: search.success === 'true' || search.success === true,
    canceled: search.canceled === 'true' || search.canceled === true,
  }),
})

interface SubStatus {
  isPremium: boolean
  isFounder: boolean
  subscriptionTier: string | null
}

function LegalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline text-white hover:text-zinc-300"
    >
      {children}
    </a>
  )
}

function SubscriptionModal({ onClose }: { onClose: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleContinue = () => {
    if (!agreed) return

    setSubmitting(true)
    window.location.href = 'https://buy.stripe.com/28E28q4Uh6fc5Jw35ddnW00'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Crown size={16} className="text-white" />
            Confirm Subscription
          </h2>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-3xl font-bold text-white">$4.99</span>
              <span className="text-sm text-zinc-500">/month</span>
            </div>
            <p className="text-xs text-zinc-500">neesh.+ Premium Membership</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2.5 text-xs text-zinc-400">
            <p className="text-white font-medium text-sm">Subscription Details</p>
            <p>
              Your subscription will automatically renew each month at{' '}
              <span className="text-white">$4.99/month</span> until you cancel.
            </p>
            <p>
              You may <span className="text-white">cancel anytime</span> from your
              Stripe customer portal.
            </p>
            <p>
              Subscriptions are <span className="text-white">non-refundable</span>.
              See our <LegalLink href="/refund-policy">Refund Policy</LegalLink> for details.
            </p>
          </div>

          <div className="space-y-2 text-xs text-zinc-500">
            <p className="font-medium text-zinc-400">Legal</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <LegalLink href="/terms">Terms of Service</LegalLink>
              <LegalLink href="/privacy">Privacy Policy</LegalLink>
              <LegalLink href="/community-guidelines">Community Guidelines</LegalLink>
              <LegalLink href="/refund-policy">Refund Policy</LegalLink>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-white flex-shrink-0"
            />

            <span className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
              By subscribing, I agree to the{' '}
              <LegalLink href="/terms">Terms of Service</LegalLink>,{' '}
              <LegalLink href="/privacy">Privacy Policy</LegalLink>,{' '}
              <LegalLink href="/community-guidelines">Community Guidelines</LegalLink>,
              and recurring monthly billing until canceled.
            </span>
          </label>

          <button
            onClick={handleContinue}
            disabled={!agreed || submitting}
            className="w-full py-3 bg-white text-zinc-950 font-semibold rounded-xl text-sm hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Crown size={16} />
                Continue to Stripe
              </>
            )}
          </button>

          <p className="text-[10px] text-zinc-600 text-center">
            You will be redirected to Stripe for secure payment processing.
          </p>
        </div>
      </div>
    </div>
  )
}

function PremiumPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const { success, canceled } = Route.useSearch()

  const [status, setStatus] = useState<SubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBanner, setShowBanner] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function loadPremiumStatus() {
      setLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('username,is_premium,is_founder_override')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Premium status error:', error)
      }

      const isFounder = data?.username === 'ceo' || data?.is_founder_override === true
      const isPremium = isFounder || data?.is_premium === true

      setStatus({
        isPremium,
        isFounder,
        subscriptionTier: isPremium ? 'neesh+' : null,
      })

      setLoading(false)
    }

    loadPremiumStatus()
  }, [user])

  if (!ready || !user || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const benefits = [
    {
      icon: BadgeCheck,
      label: 'Verified Badge',
      desc: 'Stand out everywhere with a white verified checkmark.',
    },
    {
      icon: Palette,
      label: 'Profile Customization',
      desc: 'GIF avatars, profile banners, and custom theme colors.',
    },
    {
      icon: MessageSquare,
      label: 'Exclusive Members Chat',
      desc: 'Access the premium-only community channel.',
    },
    {
      icon: Shield,
      label: 'Streak Protection',
      desc: '3 monthly streak freezes for missed days.',
    },
    {
      icon: Eye,
      label: 'Profile Views',
      desc: 'See who viewed your profile.',
    },
    {
      icon: Star,
      label: 'Premium Identity',
      desc: 'Enhanced profile card and social presence.',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {showModal && <SubscriptionModal onClose={() => setShowModal(false)} />}

      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Crown size={16} className="text-yellow-400" />
          NEESH.+
        </h1>
        <p className="text-xs text-zinc-500">Premium membership</p>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 py-8 space-y-8">
        {success && showBanner && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 relative">
            <button
              onClick={() => {
                setShowBanner(false)
                navigate({ to: '/premium', search: {} as any })
              }}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
            >
              <XCircle size={16} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <CheckCircle size={20} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-emerald-400">
                Welcome to neesh.+
              </h2>
            </div>

            <p className="text-xs text-zinc-400">
              Your subscription is active. All premium features are now unlocked.
            </p>
          </div>
        )}

        {canceled && showBanner && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 relative">
            <button
              onClick={() => {
                setShowBanner(false)
                navigate({ to: '/premium', search: {} as any })
              }}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors"
            >
              <XCircle size={16} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <XCircle size={20} className="text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-300">
                Checkout canceled
              </h2>
            </div>

            <p className="text-xs text-zinc-500">
              No worries — you can subscribe anytime.
            </p>
          </div>
        )}

        {status?.isFounder && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Crown size={20} className="text-yellow-400" />
              <h2 className="text-sm font-semibold text-yellow-400">
                Founder Account
              </h2>
            </div>

            <p className="text-xs text-zinc-400">
              You have permanent NEESH.+ access as a founder. All premium features
              are unlocked for life.
            </p>
          </div>
        )}

        {status?.isPremium && !status?.isFounder && (
          <div className="bg-gradient-to-r from-white/5 to-zinc-800/50 border border-white/20 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <BadgeCheck size={20} className="text-white" />
              <h2 className="text-sm font-semibold text-white">
                Active Subscription
              </h2>
            </div>

            <p className="text-xs text-zinc-400">
              Your NEESH.+ membership is active.
            </p>
          </div>
        )}

        {!status?.isPremium && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20">
              <BadgeCheck size={36} className="text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Upgrade to neesh.+
              </h2>
              <p className="text-sm text-zinc-500">
                Unlock premium social features
              </p>
            </div>

            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-white">$4.99</span>
              <span className="text-sm text-zinc-500">/month</span>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full py-3.5 bg-white text-zinc-950 font-semibold rounded-xl text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <Crown size={16} />
              Get neesh.+
            </button>

            <p className="text-xs text-zinc-600">Cancel anytime · Powered by Stripe</p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            What you get
          </h3>

          {benefits.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>

              {status?.isPremium && (
                <BadgeCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
            </div>
          ))}
        </div>

        {status?.isPremium && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Quick access
            </h3>

            <button
              onClick={() => navigate({ to: '/premium-chat' })}
              className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={16} className="text-white" />
                <span className="text-sm text-white">NEESH.+ Members Chat</span>
              </div>

              <ChevronRight size={14} className="text-zinc-600" />
            </button>

            <button
              onClick={() => navigate({ to: '/profile' })}
              className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Palette size={16} className="text-white" />
                <span className="text-sm text-white">Customize Profile</span>
              </div>

              <ChevronRight size={14} className="text-zinc-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
