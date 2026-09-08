import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { client } from '../api'
import { useAuth } from '../context'

type Mode = 'login' | 'register'

const INPUT = 'h-10 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] placeholder:text-[#6b6375] outline-none focus:border-[#aa3bff] transition-colors'

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'pb-3 mr-5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active ? 'border-[#08060d] text-[#08060d]' : 'border-transparent text-[#6b6375] hover:text-[#08060d]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding)
  return atob(padded)
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function parseRole(token: string): string {
    try {
      const payloadToken = token.split('.')[1]
      if (!payloadToken) return 'VIEWER'
      const payload = JSON.parse(decodeBase64Url(payloadToken)) as { role?: string }
      return payload.role ?? 'VIEWER'
    } catch {
      return 'VIEWER'
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === 'register') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { data } = await client.post<{ token: string }>('/auth/login', { username, password })
        login(data.token)
        const role = parseRole(data.token)
        navigate(role === 'VIEWER' ? '/contracts' : '/dashboard', { replace: true })
      } else {
        await client.post('/auth/register', { username, password })
        setSuccess('Account created. You can now sign in.')
        switchMode('login')
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        if (status === 401) setError('Invalid username or password.')
        else if (status === 409) setError('Username already taken.')
        else if (status === 429) setError('Too many attempts. Wait 15 minutes, or ask an admin to reset your password.')
        else if (status === 404 && mode === 'register') setError('Self sign-up is disabled. Ask an admin to create your account.')
        else setError('Something went wrong. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#f4f3ec] px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#08060d]">SAM Tracker</h1>
          <p className="mt-1 text-sm text-[#6b6375]">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
          </p>
        </div>

        <div className="bg-white border border-[#e5e4e7] rounded-xl shadow-sm px-8 py-8">
          {/* Mode tabs */}
          <div className="flex border-b border-[#e5e4e7] mb-6 -mx-8 px-8">
            <Tab label="Sign in"       active={mode === 'login'}    onClick={() => switchMode('login')} />
            <Tab label="Create account" active={mode === 'register'} onClick={() => switchMode('register')} />
          </div>

          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-5">
              {success}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-medium text-[#08060d]">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={INPUT}
                placeholder="your-username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#08060d]">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={INPUT}
                placeholder="••••••••"
              />
            </div>

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-[#08060d]">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={INPUT}
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600 -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-10 mt-1 rounded-lg bg-[#08060d] text-white text-sm font-medium hover:bg-[#2a2735] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

