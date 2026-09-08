import { useEffect, useState } from 'react'
import { client } from '../api'
import type { CredentialView } from '../types'
import '../styles/contracts.css'

const roles = ['VIEWER', 'EDITOR', 'ADMIN'] as const

type Role = typeof roles[number]

export default function UsersPage() {
  const [users, setUsers] = useState<CredentialView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savingUsernameId, setSavingUsernameId] = useState<number | null>(null)
  const [savingPasswordId, setSavingPasswordId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [userPage, setUserPage] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [usernameDrafts, setUsernameDrafts] = useState<Record<number, string>>({})
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({})

  useEffect(() => {
    client.get<CredentialView[]>('/credentials')
      .then(response => setUsers(response.data ?? []))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }, [])

  async function updateRole(id: number, role: Role) {
    setSavingId(id)
    setError(null)
    try {
      await client.patch(`/credentials/${id}/role`, { role })
      setUsers(previous => previous.map(user => user.id === id ? { ...user, role } : user))
    } catch (err: any) {
      setError(typeof err?.response?.data?.message === 'string' ? err.response.data.message : 'Failed to update user role.')
    } finally {
      setSavingId(null)
    }
  }

  async function updateUsername(id: number, username: string) {
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Username cannot be empty.')
      return
    }

    setSavingUsernameId(id)
    setError(null)
    try {
      const response = await client.patch(`/credentials/${id}/username`, { username: trimmed })
      setUsers(previous => previous.map(user => user.id === id ? { ...user, username: response.data.username } : user))
      setUsernameDrafts(previous => ({ ...previous, [id]: response.data.username }))
    } catch (err: any) {
      setError(typeof err?.response?.data?.message === 'string' ? err.response.data.message : 'Failed to update username.')
    } finally {
      setSavingUsernameId(null)
    }
  }

  async function updatePassword(id: number, password: string) {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSavingPasswordId(id)
    setError(null)
    try {
      await client.patch(`/credentials/${id}/password`, { password })
      setPasswordDrafts(previous => ({ ...previous, [id]: '' }))
    } catch (err: any) {
      setError(typeof err?.response?.data?.message === 'string' ? err.response.data.message : 'Failed to update password.')
    } finally {
      setSavingPasswordId(null)
    }
  }

  const matchingUsers = users.filter(user => user.username.toLowerCase().includes(searchText.trim().toLowerCase()))
  const userPageSize = 8
  const userPageCount = Math.max(1, Math.ceil(matchingUsers.length / userPageSize))
  const visibleUsers = matchingUsers.slice(userPage * userPageSize, (userPage + 1) * userPageSize)
  const selectedUser = users.find(user => user.id === selectedUserId) ?? null

  return (
    <div className="users-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Users</h1>
        <span className="text-sm text-[#6b6375]">{users.length} users</span>
      </div>
      <div className="users-toolbar">
        <p className="users-page-intro">Manage access and account credentials for everyone in the workspace.</p>
        <label className="users-search">
          <span>Search users</span>
          <input value={searchText} onChange={event => { setSearchText(event.target.value); setUserPage(0) }} placeholder="Search by username" />
        </label>
      </div>
      {loading && <p className="text-sm text-[#6b6375]">Loading users…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="users-directory">
          {visibleUsers.map(user => (
            <button type="button" className="user-directory-row" key={user.id} onClick={() => setSelectedUserId(user.id)}>
              <span className="users-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
              <span className="user-directory-main"><strong>{user.username}</strong><small>{user.lastLoginAt ? `Last login ${new Date(user.lastLoginAt).toLocaleString()}` : 'Never logged in'}</small></span>
              <span className={`user-role-badge user-role-${user.role.toLowerCase()}`}>{user.role}</span>
              <span className="user-directory-arrow">View</span>
            </button>
          ))}
          {visibleUsers.length === 0 && <p className="users-empty">No users match “{searchText}”.</p>}
          {matchingUsers.length > userPageSize && <div className="users-pagination"><button type="button" onClick={() => setUserPage(page => Math.max(0, page - 1))} disabled={userPage === 0}>Previous</button><span>Page {userPage + 1} of {userPageCount}</span><button type="button" onClick={() => setUserPage(page => Math.min(userPageCount - 1, page + 1))} disabled={userPage >= userPageCount - 1}>Next</button></div>}
        </div>
      )}
      {selectedUser && (
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedUserId(null) }}>
          <div className="contracts-modal user-details-modal" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
            <div className="contracts-modal-head"><div><p className="vendor-edit-kicker">USER PROFILE</p><h2 id="user-details-title">{selectedUser.username}</h2></div><button type="button" className="contracts-modal-close" onClick={() => setSelectedUserId(null)} aria-label="Close">×</button></div>
            <div className="contracts-modal-body user-details-body">
              <div className="user-details-meta"><span className="users-avatar user-details-avatar">{selectedUser.username.slice(0, 1).toUpperCase()}</span><div><strong>{selectedUser.role}</strong><small>Created {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'} · Last login {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'}</small></div></div>
              <label className="user-modal-field">Username<input value={usernameDrafts[selectedUser.id] ?? selectedUser.username} onChange={event => setUsernameDrafts(previous => ({ ...previous, [selectedUser.id]: event.target.value }))} /></label>
              <div className="user-modal-grid"><label className="user-modal-field">Role<select value={selectedUser.role} disabled={savingId === selectedUser.id} onChange={event => void updateRole(selectedUser.id, event.target.value as Role)}>{roles.map(role => <option key={role} value={role}>{role}</option>)}</select></label><label className="user-modal-field">New password<input type="password" value={passwordDrafts[selectedUser.id] ?? ''} onChange={event => setPasswordDrafts(previous => ({ ...previous, [selectedUser.id]: event.target.value }))} placeholder="At least 8 characters" /></label></div>
            </div>
            <div className="user-details-actions"><button type="button" className="contracts-clear-button" onClick={() => setSelectedUserId(null)}>Close</button><button type="button" className="users-save-button" disabled={savingUsernameId === selectedUser.id} onClick={() => void updateUsername(selectedUser.id, usernameDrafts[selectedUser.id] ?? selectedUser.username)}>{savingUsernameId === selectedUser.id ? 'Saving…' : 'Save username'}</button><button type="button" className="users-password-button" disabled={savingPasswordId === selectedUser.id} onClick={() => void updatePassword(selectedUser.id, passwordDrafts[selectedUser.id] ?? '')}>{savingPasswordId === selectedUser.id ? 'Saving…' : 'Set password'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
