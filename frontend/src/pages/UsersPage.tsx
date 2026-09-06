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

  return (
    <div className="users-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Users</h1>
        <span className="text-sm text-[#6b6375]">{users.length} users</span>
      </div>
      {loading && <p className="text-sm text-[#6b6375]">Loading users…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="contracts-panel users-panel">
          <table className="contracts-table users-table">
            <thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="contract-row">
                  <td className="font-semibold">{user.username}</td>
                  <td>
                    <select value={user.role} disabled={savingId === user.id} onChange={event => void updateRole(user.id, event.target.value as Role)}>
                      {roles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
