import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context'

interface NavItem {
  label: string
  path: string
  roles: string[]
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   path: '/dashboard',   roles: ['EDITOR', 'ADMIN'] },
  { label: 'Contracts',    path: '/contracts',    roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Vendors',      path: '/vendors',      roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Licenses',     path: '/licenses',     roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Departments',  path: '/departments',  roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Users',        path: '/users',        roles: ['ADMIN'] },
]

const FINANCE_NAV_ITEMS: NavItem[] = [
  { label: 'Summary',     path: '/finance',              roles: ['VIEWER', 'EDITOR', 'ADMIN'], end: true },
  { label: 'Detailed',    path: '/finance/detailed',     roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'All Months',  path: '/finance/all-months',   roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
  { label: 'Inventory',   path: '/finance/inventory',    roles: ['VIEWER', 'EDITOR', 'ADMIN'] },
]


const ICONS: Record<string, string> = {
  Dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  Contracts: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8',
  Vendors: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
  Licenses: 'M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 16.5 6.5 19.5l1-6.2L3 8.9 9 8z',
  Departments: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  Users: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  Summary: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  Detailed: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'All Months': 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  Inventory: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
}

function NavIcon({ label }: { label: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={ICONS[label] ?? ''} />
    </svg>
  )
}

type WorkspaceView = 'procurement' | 'finance'

export default function AppShell() {
  const { user, logout } = useAuth()
  const role = user?.role ?? 'VIEWER'
  const navigate = useNavigate()
  const location = useLocation()
  const [view, setView] = useState<WorkspaceView>(() => location.pathname.startsWith('/finance') ? 'finance' : 'procurement')

  // Keep the dropdown in sync if the user lands on /finance directly (e.g. via a bookmark).
  useEffect(() => {
    setView(location.pathname.startsWith('/finance') ? 'finance' : 'procurement')
  }, [location.pathname])

  function handleViewChange(next: WorkspaceView) {
    setView(next)
    navigate(next === 'finance' ? '/finance' : '/contracts')
  }

  const visibleItems = view === 'finance' ? FINANCE_NAV_ITEMS : NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <div className="min-h-screen flex bg-[#f7f6f3]">
      <aside className="w-56 shrink-0 bg-white border-r border-[#e5e4e7] flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-[#e5e4e7] shrink-0">
          <img src="/logo-color.svg" alt="SAM Tracker" className="h-9 w-9 object-contain" />
          <span className="ml-2 text-sm font-semibold text-[#08060d] tracking-tight">SAM Tracker</span>
        </div>
        <div className="px-3 py-3 border-b border-[#e5e4e7] shrink-0">
          <div role="tablist" aria-label="Workspace view" className="flex p-1 rounded-lg bg-[#f4f3ec]">
            {(['procurement', 'finance'] as WorkspaceView[]).map(v => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => handleViewChange(v)}
                className={
                  'flex-1 h-7 rounded-md text-xs font-medium capitalize transition-all ' +
                  (view === v
                    ? 'bg-white text-[#0f766e] shadow-sm'
                    : 'text-[#6b6375] hover:text-[#08060d]')
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:translate-x-0.5 ' +
                (isActive
                  ? 'bg-[#e6f2f0] text-[#0f766e] font-medium'
                  : 'text-[#6b6375] hover:text-[#08060d] hover:bg-[#f4f3ec]')
              }
            >
              <NavIcon label={item.label} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-[#e5e4e7] flex items-center justify-end gap-4 px-6">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="h-8 w-8 rounded-full bg-[#e6f2f0] text-[#0f766e] flex items-center justify-center text-xs font-semibold uppercase">
              {user?.username?.slice(0, 1)}
            </span>
            <span className="font-medium text-[#08060d]">{user?.username}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#e6f2f0] text-[#0f766e] text-[11px] font-semibold tracking-wide">{role}</span>
          </div>
          <div className="h-5 w-px bg-[#e5e4e7]" />
          <button
            onClick={logout}
            className="text-sm text-[#6b6375] px-3 py-1.5 rounded-lg border border-[#e5e4e7] hover:text-[#0f766e] hover:border-[#0f766e] hover:bg-[#e6f2f0] transition-all"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
