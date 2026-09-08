import { Fragment, type FormEvent, useEffect, useState } from 'react'
import { client } from '../api'
import { useAuth } from '../context'
import type { CredentialView } from '../types'
import '../styles/contracts.css'

const roles = ['VIEWER', 'EDITOR', 'ADMIN'] as const

type Role = typeof roles[number]

const REFRESH_MS = 30_000

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Never'
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  })
}

function relativeTime(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const seconds = Math.round((Date.now() - parsed.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2592000], ['year', 31536000]]
  let chosen = units[0]
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    .format(-Math.round(seconds / chosen[1]), chosen[0])
}

function messageFrom(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response
  if (typeof response?.data?.message === 'string' && response.data.message) return response.data.message
  if (response?.status === 409) return 'Username already taken.'
  return fallback
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<CredentialView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('VIEWER')
  const [creating, setCreating] = useState(false)

  const [passwordTargetId, setPasswordTargetId] = useState<number | null>(null)
  const [passwordValue, setPasswordValue] = useState('')

  useEffect(() => {
    let active = true
    const load = (initial: boolean) => {
      client.get<CredentialView[]>('/credentials')
        .then(response => { if (active) setUsers(Array.isArray(response.data) ? response.data : []) })
        .catch(() => { if (active && initial) setError('Failed to load users.') })
        .finally(() => { if (active && initial) setLoading(false) })
    }
    load(true)
    // keeps the signed-in indicator and relative timestamps current without a manual refresh
    const timer = setInterval(() => load(false), REFRESH_MS)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const onlineCount = users.filter(user => user.online).length

  async function addUser(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setCreating(true)
    try {
      const { data } = await client.post<CredentialView>('/credentials', {
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      })
      setUsers(previous => [...previous, data])
      setNewUsername('')
      setNewPassword('')
      setNewRole('VIEWER')
      setNotice(`User "${data.username}" created.`)
    } catch (err) {
      setError(messageFrom(err, 'Failed to create user.'))
    } finally {
      setCreating(false)
    }
  }

  async function updateRole(id: number, role: Role) {
    setSavingId(id)
    setError(null)
    setNotice(null)
    try {
      await client.patch(`/credentials/${id}/role`, { role })
      setUsers(previous => previous.map(user => user.id === id ? { ...user, role } : user))
    } catch (err) {
      setError(messageFrom(err, 'Failed to update user role.'))
    } finally {
      setSavingId(null)
    }
  }

  async function savePassword(event: FormEvent, target: CredentialView) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (passwordValue.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSavingId(target.id)
    try {
      await client.patch(`/credentials/${target.id}/password`, { password: passwordValue })
      setPasswordTargetId(null)
      setPasswordValue('')
      setNotice(`Password updated for "${target.username}".`)
    } catch (err) {
      setError(messageFrom(err, 'Failed to update password.'))
    } finally {
      setSavingId(null)
    }
  }

  function togglePasswordForm(id: number) {
    setError(null)
    setNotice(null)
    setPasswordValue('')
    setPasswordTargetId(previous => previous === id ? null : id)
  }

  return (
    <div className="users-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Users</h1>
        <span className="text-sm text-[#6b6375]">{onlineCount} signed in · {users.length} users</span>
      </div>

      <form className="contracts-panel user-add-form" onSubmit={addUser}>
        <input
          type="text"
          value={newUsername}
          onChange={event => setNewUsername(event.target.value)}
          placeholder="Username"
          autoComplete="off"
          required
        />
        <input
          type="password"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          placeholder="Password (min 8 characters)"
          autoComplete="new-password"
          required
        />
        <select value={newRole} onChange={event => setNewRole(event.target.value as Role)}>
          {roles.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
        <button type="submit" className="license-renew-button" disabled={creating}>
          {creating ? 'Adding…' : 'Add user'}
        </button>
      </form>

      {loading && <p className="text-sm text-[#6b6375]">Loading users…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {!loading && (
        <div className="contracts-panel users-panel">
          <table className="contracts-table users-table">
            <thead>
              <tr><th>Status</th><th>Username</th><th>Role</th><th>Last login</th><th>Last activity</th><th>Created</th><th>Password</th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <Fragment key={user.id}>
                  <tr className="contract-row">
                    <td>
                      <span className={`user-status ${user.online ? 'is-online' : 'is-offline'}`}>
                        <i aria-hidden="true" />{user.online ? 'Signed in' : 'Signed out'}
                      </span>
                    </td>
                    <td className="font-semibold">
                      {user.username}
                      {user.username === currentUser?.username && <small className="user-self-tag"> (you)</small>}
                    </td>
                    <td>
                      <select value={user.role} disabled={savingId === user.id} onChange={event => void updateRole(user.id, event.target.value as Role)}>
                        {roles.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td title={formatDateTime(user.lastLoginAt)}>
                      <span className="user-timestamp">{formatDateTime(user.lastLoginAt)}</span>
                      {relativeTime(user.lastLoginAt) && <small>{relativeTime(user.lastLoginAt)}</small>}
                    </td>
                    <td title={formatDateTime(user.lastSeenAt)}>
                      <span className="user-timestamp">{relativeTime(user.lastSeenAt) ?? 'Never'}</span>
                    </td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <button type="button" className="contracts-clear-button" onClick={() => togglePasswordForm(user.id)}>
                        {passwordTargetId === user.id ? 'Cancel' : 'Change password'}
                      </button>
                    </td>
                  </tr>
                  {passwordTargetId === user.id && (
                    <tr>
                      <td colSpan={7}>
                        <form className="user-password-form" onSubmit={event => void savePassword(event, user)}>
                          <input
                            type="password"
                            value={passwordValue}
                            onChange={event => setPasswordValue(event.target.value)}
                            placeholder={`New password for ${user.username}`}
                            autoComplete="new-password"
                            required
                          />
                          <button type="submit" className="license-renew-button" disabled={savingId === user.id}>
                            {savingId === user.id ? 'Saving…' : 'Save password'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
