import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { signup, AuthError } from '@netlify/identity'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useState, useCallback, useRef } from 'react'
import { Check } from 'lucide-react'

export const Route = createFileRoute('/signup')({
  component: SignUpPage,
})

function SignUpPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [usernameError, setUsernameError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (ready && user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const checkUsername = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length < 3) {
      setUsernameStatus('idle')
      setUsernameError(value.length > 0 ? 'At least 3 characters' : '')
      return
    }

    setUsernameStatus('checking')
    setUsernameError('')

    debounceRef.current = setTimeout(async () => {
      const clean = value.toLowerCase().trim()

      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', clean)
        .maybeSingle()

      if (error) {
        console.error('Username check error:', error)
        setUsernameStatus('idle')
        setUsernameError('Could not check availability')
        return
      }

      if (data) {
        setUsernameStatus('taken')
        setUsernameError('Username is already taken')
      } else {
        setUsernameStatus('available')
        setUsernameError('')
      }
    }, 400)
  }, [])

  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)
    setUsername(clean)
    checkUsername(clean)
  }

  const handleSignup = async () => {
    if (usernameStatus !== 'available') return

    if (!displayName.trim()) {
      setMessage('Display name is required.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const newUser = await signup(email, password, {
        full_name: displayName.trim(),
        username,
      })

      const newUserId =
        (newUser as any).id ??
        (newUser as any).sub ??
        (newUser as any).user?.id ??
        null

      if (newUserId) {
        await supabase
          .from('profiles')
          .upsert({
            id: newUserId,
            username,
            display_name: displayName.trim(),
            avatar_url: '',
            banner_url: '',
            bio: '',
            interests: [],
            total_xp: 0,
            message_count: 0,
            current_streak: 0,
            longest_streak: 0,
            is_premium: false,
            is_founder_override: username === 'ceo',
          })
      }

      if ((newUser as any).emailVerified || (newUser as any).confirmed_at) {
        navigate({ to: '/home', replace: true })
      } else {
        setStatus('done')
        setMessage(`Check ${email} for a confirmation link. Click it to activate your account, then sign in.`)
      }
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        if (err.status === 422) {
          setMessage('Invalid email or password too short (min 6 characters).')
        } else if (err.status === 403) {
          setMessage('Signups are currently disabled.')
        } else {
          setMessage(err.message || 'Signup failed.')
        }
      } else {
        setMessage('Signup failed. Please try again.')
      }

      setStatus('error')
    }
  }

  const canSubmit =
    usernameStatus === 'available' &&
    displayName.trim().length > 0 &&
    email &&
    password &&
    status !== 'loading' &&
    status !== 'done'

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/neesh-logo.png" alt="neesh" className="h-28 mx-auto mb-2" />
          </Link>
          <p className="text-zinc-500 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Username
            </label>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                @
              </span>

              <input
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="username"
                maxLength={20}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <Check size={16} className="text-emerald-400" />
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-red-400 text-sm">&#10005;</span>
                )}
              </div>
            </div>

            {usernameError && (
              <p className="text-xs text-red-400 mt-1">{usernameError}</p>
            )}

            {usernameStatus === 'available' && (
              <p className="text-xs text-emerald-400 mt-1">@{username} is available</p>
            )}

            <p className="text-[11px] text-zinc-600 mt-1">
              3–20 characters. Letters, numbers, underscores, periods.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSignup()}
            />
          </div>

          {message && (
            <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {message}
            </p>
          )}

          <button
            onClick={handleSignup}
            disabled={!canSubmit}
            className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {status === 'loading'
              ? 'Creating account…'
              : status === 'done'
                ? 'Check your email'
                : 'Create Account'}
          </button>

          <p className="text-center text-xs text-zinc-500 pt-1">
            Already have an account?{' '}
            <Link to="/signin" className="text-white hover:underline underline-offset-2">
              Sign In
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-4 px-4 leading-relaxed">
          By signing up, you agree to our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-zinc-400">
            Terms
          </Link>
          ,{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-zinc-400">
            Privacy Policy
          </Link>
          , and{' '}
          <Link to="/community-guidelines" className="underline underline-offset-2 hover:text-zinc-400">
            Guidelines
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
