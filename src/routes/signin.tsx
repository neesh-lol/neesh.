import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { login, AuthError } from '@netlify/identity'
import { useIdentity } from '@/lib/identity-context'
import { useState } from 'react'

export const Route = createFileRoute('/signin')({
  component: SignInPage,
})

function SignInPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  if (ready && user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const handleLogin = async () => {
    setStatus('loading')
    setMessage('')
    setShowResend(false)
    try {
      await login(email, password)
      navigate({ to: '/home', replace: true })
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        if (err.message?.toLowerCase().includes('email not confirmed') || err.message?.toLowerCase().includes('not confirmed')) {
          setMessage('Email not confirmed. Check your inbox or resend the verification email.')
          setShowResend(true)
        } else if (err.status === 401) {
          setMessage('Invalid email or password.')
        } else {
          setMessage(err.message || 'Sign in failed.')
        }
      } else {
        setMessage('Sign in failed. Please try again.')
      }
      setStatus('error')
    }
  }

  const handleResend = async () => {
    if (!email) return
    setStatus('loading')
    setMessage('')
    try {
      const { signup } = await import('@netlify/identity')
      await signup(email, password || 'temp-resend', { full_name: email.split('@')[0] })
      setMessage(`Verification email resent to ${email}. Check your inbox.`)
      setStatus('idle')
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        if (err.message?.toLowerCase().includes('already registered') || err.status === 422) {
          setMessage('If this email exists, a confirmation was already sent. Check your inbox and spam folder.')
          setStatus('idle')
        } else {
          setMessage(err.message || 'Failed to resend.')
          setStatus('error')
        }
      } else {
        setMessage('Failed to resend. Please try again.')
        setStatus('error')
      }
    }
  }

  const handleForgot = async () => {
    if (!email) {
      setMessage('Enter your email address first.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const { requestPasswordRecovery } = await import('@netlify/identity')
      await requestPasswordRecovery(email)
      setMessage(`Password reset link sent to ${email}. Check your inbox.`)
      setStatus('idle')
      setShowForgot(false)
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setMessage(err.message || 'Failed to send reset email.')
      } else {
        setMessage('Failed. Please try again.')
      }
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/neesh-logo.png" alt="neesh" className="h-28 mx-auto mb-2" />
          </Link>
          <p className="text-zinc-500 text-sm mt-1">Welcome back</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {message && (
            <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {message}
            </p>
          )}

          {showResend && (
            <button
              onClick={handleResend}
              disabled={status === 'loading'}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium rounded-xl py-2 text-xs hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          <button
            onClick={handleLogin}
            disabled={status === 'loading'}
            className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="text-center text-xs text-zinc-500 space-y-2 pt-1">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="text-white hover:underline underline-offset-2">
                Sign Up
              </Link>
            </p>
            <p>
              <button
                onClick={() => {
                  if (showForgot) {
                    handleForgot()
                  } else {
                    setShowForgot(true)
                    setMessage('')
                  }
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                {showForgot ? 'Send reset link' : 'Forgot password?'}
              </button>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6">
          <Link to="/terms" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Terms</Link>
          <Link to="/privacy" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</Link>
          <Link to="/refund-policy" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Refund Policy</Link>
          <Link to="/community-guidelines" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Guidelines</Link>
        </div>
      </div>
    </div>
  )
}
