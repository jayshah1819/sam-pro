import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context'
import { useState } from 'react'
import { client } from '../api'

interface NavItem {
  label: string
  path: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   path: '/dashboard',   roles: ['EDITOR', 'ADMIN'] },
  { label: 'Contracts',    path: '/contracts',    roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Vendors',      path: '/vendors',      roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Licenses',     path: '/licenses',     roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Users',        path: '/users',        roles: ['ADMIN'] },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const role = user?.role ?? 'VIEWER'
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <div className="min-h-screen flex bg-[#f7f6f3]">
      <aside className="w-56 shrink-0 bg-white border-r border-[#e5e4e7] flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-[#e5e4e7] shrink-0">
          <img src="/logo-color.svg" alt="SAM Tracker" className="h-9 w-9 object-contain" />
          <span className="ml-2 text-sm font-semibold text-[#08060d] tracking-tight">SAM Tracker</span>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                'block px-4 py-2 text-sm transition-colors ' +
                (isActive
                  ? 'bg-[#f4f3ec] text-[#08060d] font-medium'
                  : 'text-[#6b6375] hover:text-[#08060d] hover:bg-[#f7f6f3]')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-[#e5e4e7] flex items-center justify-end gap-3 px-6">
          <div className="relative">
            <button type="button" onClick={() => setProfileOpen(previous => !previous)} className="flex items-center gap-2 rounded-full border border-[#e5e4e7] bg-white px-2 py-1.5 text-sm hover:border-[#203c3a]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#203c3a] text-xs font-bold text-white">{(user?.username?.[0] ?? 'U').toUpperCase()}</span>
              <span className="font-medium text-[#08060d]">{user?.username}</span>
              <span className="text-xs text-[#6b6375]">{profileOpen ? '▲' : '▼'}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 z-20 w-64 border border-[#e5e4e7] bg-white p-4 shadow-lg">
                <p className="mb-1 text-xs uppercase tracking-widest text-[#6b6375]">Signed in as</p>
                <p className="font-semibold text-[#08060d]">{user?.username}</p>
                <p className="mt-1 text-xs text-[#6b6375]">Role: {role}</p>
                <button type="button" onClick={() => { setPasswordOpen(true); setProfileOpen(false); setPasswordMessage(null) }} className="mt-4 w-full border-t border-[#e5e4e7] pt-3 text-left text-sm font-medium text-[#203c3a]">Change password</button>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="text-sm text-[#6b6375] hover:text-[#08060d] transition-colors"
          >
            Sign out
          </button>
        </header>
        {passwordOpen && (
          <div className="contracts-modal-overlay account-password-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPasswordOpen(false) }}>
          <div className="contracts-modal account-password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <div className="contracts-modal-head"><div><p className="vendor-edit-kicker">ACCOUNT SECURITY</p><h2 id="password-modal-title">Change password</h2></div><button type="button" className="contracts-modal-close" onClick={() => setPasswordOpen(false)} aria-label="Close">×</button></div>
            <form
              className="contracts-modal-body account-password-form"
              onSubmit={async event => {
                event.preventDefault()
                setPasswordMessage(null)
                if (newPassword.length < 8) {
                  setPasswordMessage('New password must be at least 8 characters.')
                  return
                }
                setSavingPassword(true)
                try {
                  await client.patch('/auth/me/password', { currentPassword, newPassword })
                  setCurrentPassword('')
                  setNewPassword('')
                  setPasswordMessage('Password changed successfully.')
                } catch (err: any) {
                  setPasswordMessage(typeof err?.response?.data?.message === 'string' ? err.response.data.message : 'Failed to change password.')
                } finally {
                  setSavingPassword(false)
                }
              }}
            >
              <label className="account-password-field">
                Current password
                <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
              </label>
              <label className="account-password-field">
                New password
                <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required />
              </label>
              <div className="account-password-actions">
              <button type="button" onClick={() => setPasswordOpen(false)} className="contracts-clear-button">Cancel</button>
              <button type="submit" disabled={savingPassword} className="contracts-search-button">
                {savingPassword ? 'Saving…' : 'Save password'}
              </button>
              </div>
              {passwordMessage && <p className="account-password-message">{passwordMessage}</p>}
            </form>
          </div>
          </div>
        )}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
