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
        <div className="px-4 py-2 border-b border-[#e5e4e7] shrink-0">
          <select
            value={view}
            onChange={event => handleViewChange(event.target.value as WorkspaceView)}
            aria-label="Workspace view"
            className="w-full h-8 px-2 rounded-md border border-[#e5e4e7] text-xs text-[#08060d] bg-white cursor-pointer"
          >
            <option value="procurement">Procurement</option>
            <option value="finance">Finance</option>
          </select>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.end}
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
        <header className="h-14 shrink-0 bg-white border-b border-[#e5e4e7] flex items-center justify-end gap-4 px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-[#08060d]">{user?.username}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#e9f0ef] text-[#1e4048] text-xs font-semibold">{role}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-[#6b6375] hover:text-[#08060d] transition-colors"
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
