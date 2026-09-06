import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import ForbiddenPage from './pages/ForbiddenPage'
import LoginPage from './pages/LoginPage'
import ContractsPage from './pages/ContractsPage'
import VendorsPage from './pages/VendorsPage'
import LicensesPage from './pages/LicensesPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import RequireRole from './components/RequireRole'

export const router = createBrowserRouter([
  { path: '/',      element: <Navigate to="/contracts" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/403',   element: <ForbiddenPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/contracts', element: <ContractsPage /> },
          {
            element: <RequireRole roles={['EDITOR', 'ADMIN']} />,
            children: [{ path: '/dashboard', element: <DashboardPage /> }],
          },
          { path: '/vendors', element: <VendorsPage /> },
          { path: '/licenses', element: <LicensesPage /> },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [{ path: '/users', element: <UsersPage /> }],
          },
        ],
      },
    ],
  },
])
