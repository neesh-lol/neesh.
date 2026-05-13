import { useEffect, useState } from 'react'
import { handleAuthCallback, AuthError } from '@netlify/identity'
import { useIdentity } from '@/lib/identity-context'

const AUTH_HASH_PATTERN =
  /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/

export function CallbackHandler({ children }: { children: React.ReactNode }) {
  const { refreshUser } = useIdentity()
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !AUTH_HASH_PATTERN.test(window.location.hash)) return
    setProcessing(true)

    const processCallback = async () => {
      try {
        const result = await handleAuthCallback()
        if (!result) return

        window.history.replaceState(null, '', window.location.pathname)

        switch (result.type) {
          case 'confirmation':
            await refreshUser()
            setBanner({ type: 'success', text: 'Email confirmed! You are now logged in.' })
            break
          case 'recovery':
            await refreshUser()
            setRecoveryMode(true)
            setBanner({ type: 'success', text: 'Set your new password below.' })
            break
          case 'oauth':
            await refreshUser()
            setBanner({ type: 'success', text: 'Logged in successfully.' })
            break
          case 'email_change':
            await refreshUser()
            setBanner({ type: 'success', text: 'Email address updated.' })
            break
          case 'invite':
            setBanner({ type: 'success', text: 'Invite accepted! Set your password to continue.' })
            break
        }
      } catch (error) {
        window.history.replaceState(null, '', window.location.pathname)
        if (error instanceof AuthError) {
          const msg = error.status === 401
            ? 'This link has expired. Please request a new one.'
            : error.message
          setBanner({ type: 'error', text: msg })
        } else {
          setBanner({ type: 'error', text: 'Something went wrong. Please try again.' })
        }
      } finally {
        setProcessing(false)
      }
    }

    processCallback()
  }, [refreshUser])

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setBanner({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    setSaving(true)
    try {
      const { updateUser } = await import('@netlify/identity')
      await updateUser({ password: newPassword })
      setRecoveryMode(false)
      setNewPassword('')
      await refreshUser()
      setBanner({ type: 'success', text: 'Password updated! You are now logged in.' })
    } catch (error) {
      if (error instanceof AuthError) {
        setBanner({ type: 'error', text: error.message })
      } else {
        setBanner({ type: 'error', text: 'Failed to update password.' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (processing) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          <p className="text-sm text-zinc-400">Verifying…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {banner && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-sm text-center ${
          banner.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="ml-4 opacity-70 hover:opacity-100">
            &times;
          </button>
        </div>
      )}
      {recoveryMode && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white">Reset Password</h2>
            <p className="text-sm text-zinc-400">Enter your new password.</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordReset()}
            />
            <button
              onClick={handlePasswordReset}
              disabled={saving}
              className="w-full bg-white text-zinc-950 font-medium rounded-lg py-2.5 text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Updating…' : 'Set new password'}
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
